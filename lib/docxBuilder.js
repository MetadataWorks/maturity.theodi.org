const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BulletList, NumberedList, WidthType, AlignmentType, ShadingType, patchDocument, PatchType } = require('docx');
const fs = require('fs');
const tmp = require('tmp-promise');
const { parse } = require('node-html-parser');

const colors = {
    level1: { background: "#dd1d1d", text: "#FFFFFF" },
    level2: { background: "#F96701", text: "#FFFFFF" },
    level3: { background: "#2fbc37", text: "#FFFFFF" },
    level4: { background: "#178cff", text: "#FFFFFF" },
    level5: { background: "#072589", text: "#FFFFFF" },
    lightGrey: "#E2E6E9",
    green: "#0dbc37",
    white: "#ffffff",
    darkblue: "#072589"
};

function blendColor(colorHex, percentage) {
    const baseColor = hexToRgb(colorHex);
    const white = { r: 255, g: 255, b: 255 };

    const blendedColor = {
        r: Math.round(baseColor.r + (white.r - baseColor.r) * (1 - percentage)),
        g: Math.round(baseColor.g + (white.g - baseColor.g) * (1 - percentage)),
        b: Math.round(baseColor.b + (white.b - baseColor.b) * (1 - percentage)),
    };

    return rgbToHex(blendedColor.r, blendedColor.g, blendedColor.b);
}

function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return { r, g, b };
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Convert HTML to docx elements
function htmlToDocxElements(htmlString) {
    // Remove newline characters
    const cleanedHtmlString = htmlString.replace(/\n/g, ' ').trim();

    const root = parse(cleanedHtmlString);
    const elements = [];

    function traverse(node, listLevel = 0) {
        if (node.nodeType === 3) { // Text node
            const textContent = node.rawText.trim();
            if (textContent !== '') {
                return [new TextRun(textContent)];
            }
            return []; // Return an empty array if the text is empty
        }

        const tagName = node.tagName ? node.tagName.toLowerCase() : null;

        if (tagName === 'p') {
            const paragraphChildren = node.childNodes.flatMap(child => traverse(child, listLevel));
            return [new Paragraph({ children: paragraphChildren })];
        } else if (tagName === 'strong' || tagName === 'b') {
            const textContent = node.text.trim();
            if (textContent !== '') {
                return [new TextRun({ text: textContent, bold: true })];
            }
            return [];
        } else if (tagName === 'em' || tagName === 'i') {
            const textContent = node.text.trim();
            if (textContent !== '') {
                return [new TextRun({ text: textContent, italics: true })];
            }
            return [];
        } else if (tagName === 'u') {
            const textContent = node.text.trim();
            if (textContent !== '') {
                return [new TextRun({ text: textContent, underline: {} })];
            }
            return [];
        } else if (tagName === 'br') {
            return [new TextRun({ text: '\n' })];
        } else if (tagName === 'table') {
            const tableChildren = node.childNodes.flatMap(child => traverse(child, listLevel));
            return [new Table({ rows: tableChildren })];
        } else if (tagName === 'tr') {
            const rowChildren = node.childNodes.flatMap(child => traverse(child, listLevel));
            return [new TableRow({ children: rowChildren })];
        } else if (tagName === 'td' || tagName === 'th') {
            const cellChildren = node.childNodes.flatMap(child => traverse(child, listLevel));
            return [new TableCell({ children: cellChildren })];
        } else if (tagName === 'ul' || tagName === 'ol') {
            const listItems = node.childNodes.flatMap(child => traverse(child, listLevel + 1));
            return listItems;
        } else if (tagName === 'li') {
            const textContent = node.text.trim();
            if (textContent !== '') {
                return [new Paragraph({
                    text: textContent,
                    bullet: { level: (listLevel-1) },
                })];
            }
            return [];
        } else {
            // For unsupported tags or tags that don't need conversion, traverse their children
            return node.childNodes.flatMap(child => traverse(child, listLevel));
        }
    }

    elements.push(...traverse(root));

    // Remove any top-level TextRun elements and ensure they are within Paragraphs
    const filteredElements = [];
    let paragraphBuffer = [];

    for (const element of elements) {
        if (element instanceof TextRun) {
            paragraphBuffer.push(element);
        } else {
            if (paragraphBuffer.length > 0) {
                filteredElements.push(new Paragraph({ children: paragraphBuffer }));
                paragraphBuffer = [];
            }
            filteredElements.push(element);
        }
    }

    // If any TextRuns were left in the buffer, add them as a final paragraph
    if (paragraphBuffer.length > 0) {
        filteredElements.push(new Paragraph({ children: paragraphBuffer }));
    }

    return filteredElements;
}

function createMetadataSection(projectData) {
    const metadata = [
        new Paragraph({
            text: "projectData.title",
            heading: "Heading1",
        }),
        new Paragraph(`Organisation: ${projectData.organisation?.title || "-"}`),
        new Paragraph(`Country: ${projectData.organisation.country?.name || "-"}`),
        new Paragraph(`Created Date: ${new Date(projectData.created).toLocaleDateString()}`),
        new Paragraph(`Last Modified: ${new Date(projectData.lastModified).toLocaleDateString()}`),
        new Paragraph(`Notes: ${projectData.notes || "-"}`),
    ];

    return metadata;
}

function createExecutiveSummary(projectData) {
    const summary = [
        new Paragraph({
            text: "Executive summary",
            heading: "Heading1",
        }),
    ];
    if (projectData.assessmentData.aiExecutiveSummary && projectData.assessmentData.aiExecutiveSummary.summary) {
        const docxElements = htmlToDocxElements(projectData.assessmentData.aiExecutiveSummary.summary);
        summary.push(...docxElements);
    }
    return summary;
}

function createMaturitySection(assessmentData, levelKeys) {
    const levelColors = {
        1: colors.level1.background, // Initial -- red
        2: colors.level2.background, // Repeatable -- orange
        3: colors.level3.background, // Defined -- green
        4: colors.level4.background, // Managed -- light blue
        5: colors.level5.background, // Optimising -- blue
        none: colors.lightGrey,       // No level achieved -- light grey
    };

    const overallLevel = assessmentData.overallAchievedLevel;
    let backgroundColor, levelText;

    if (overallLevel) {
        backgroundColor = levelColors[overallLevel];
        levelText = `Overall Maturity Level: ${levelKeys[overallLevel - 1]}`;
    } else {
        backgroundColor = levelColors.none;
        levelText = "No Level Achieved";
    }

    // Create a paragraph for the overall maturity level with background color
    const overallLevelParagraph = new Paragraph({
        children: [
            new TextRun({
                text: "\n",
                size: 36, // 18pt
            }),
            new TextRun({
                text: levelText,
                bold: true,
                color: overallLevel ? colors.white : colors.darkblue,
                size: 36, // 18pt
            }),
            new TextRun({
                text: "\n",
                size: 36, // 18pt
            }),
        ],
        alignment: AlignmentType.CENTER,
        shading: {
            type: ShadingType.CLEAR,
            fill: backgroundColor,
        },
        spacing: {
            before: 200,
            after: 200,
        },
    });

    // Create paragraphs for activity and statement completion percentages
    const activityCompletionParagraph = new Paragraph({
        text: `Activity Completion: ${assessmentData.activityCompletionPercentage}%`,
        spacing: {
            before: 200,
            after: 100,
        },
        alignment: AlignmentType.CENTER,
        run: {
            size: 24, // 12pt
        }
    });

    const statementCompletionParagraph = new Paragraph({
        text: `Statement Completion: ${assessmentData.statementCompletionPercentage}%`,
        spacing: {
            before: 100,
            after: 200,
        },
        alignment: AlignmentType.CENTER,
        run: {
            size: 24, // 12pt
        }
    });

    return [
        overallLevelParagraph,
        activityCompletionParagraph,
        statementCompletionParagraph,
    ];
}

function createHeatmapSection(assessmentData, levelKeys) {
    const heatmapParagraph = new Paragraph({
        text: "Maturity Heatmap",
        heading: "Heading1",
    });

    const heatmapTable = createHeatmapTable(assessmentData, levelKeys);

    const evaluationHeading = new Paragraph({
        text: "Dimension and activity detail",
        heading: "Heading1",
    });

    return [heatmapParagraph, heatmapTable, evaluationHeading];
}

function createDimensionSection(dimension, levelKeys, dimensionIndex) {
    const dimensionTitle = new Paragraph({
        text: `Dimension: ${dimension.name}`,
        heading: "Heading2",
    });

    const currentLevelParagraph = new Paragraph({
        text: `Current Level: ${levelKeys[dimension.userProgress.achievedLevel - 1]}`,
    });


    const aiSummary = [];
    if (dimension.aiResponse && dimension.aiResponse.summary) {
        const docxElements = htmlToDocxElements(dimension.aiResponse.summary);
        aiSummary.push(...docxElements);
    }

    const dimensionHeatmap = createHeatmapTable(dimension, levelKeys);

    const activitySections = dimension.activities.flatMap((activity, activityIndex) =>
        createActivitySection(activity, dimension.name, levelKeys, dimensionIndex, activityIndex)
    );

    return [
        dimensionTitle,
        currentLevelParagraph,
        ...aiSummary,
        dimensionHeatmap,
        ...activitySections,
    ];
}

function createActivitySection(activity, dimensionName, levelKeys, dimensionIndex, activityIndex) {
    const activityTitle = new Paragraph({
        text: `Activity: ${activity.title}`,
        heading: "Heading3",
    });

    if (!activity.userProgress) {
        const noDataParagraph = new Paragraph({
            text: "No Data",
            alignment: AlignmentType.CENTER,
            shading: {
                type: ShadingType.CLEAR,
                fill: colors.lightGrey,
            },
            spacing: {
                before: 200,
                after: 200,
            },
        });

        return [
            activityTitle,
            noDataParagraph,
        ];
    }

    const currentLevelParagraph = new Paragraph({
        text: `Current Level: ${levelKeys[activity.userProgress.achievedLevel - 1]}`,
    });

    const aiSummary = [];
    if (activity.aiResponse && activity.aiResponse.summary) {
        const docxElements = htmlToDocxElements(activity.aiResponse.summary);
        aiSummary.push(...docxElements);
    }

    const activityHeatmap = createHeatmapTable(activity, levelKeys, "Activity");

    const activityQuestions = createActivityQuestionsTables(activity, levelKeys);

    return [
        activityTitle,
        currentLevelParagraph,
        ...aiSummary,
        activityHeatmap,
        ...activityQuestions.flatMap(q => q),
    ];
}

function createHeatmapTable(data, levelKeys, title = "Dimension") {
    const tableRows = [];
    const baseGreenColor = colors.green;

    try {
        // Create the header row with an additional cell for the dimension/activity name
        const headerRow = new TableRow({
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            text: title,
                            alignment: AlignmentType.CENTER,
                            style: {
                                color: colors.level1.text,
                            },
                        }),
                    ],
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                    verticalAlign: "center",
                    shading: {
                        fill: colors.lightGrey,
                    },
                }),
                ...levelKeys.map((level, index) =>
                    new TableCell({
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun( {
                                        text: level,
                                        color: "FFFFFF",
                                        verticalAlign: "center",
                                        alignment: AlignmentType.CENTER,
                                    })
                                ],
                                alignment: AlignmentType.CENTER,
                                verticalAlign: "center"
                            }),
                        ],
                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                        verticalAlign: "center",
                        shading: {
                            fill: colors[`level${index + 1}`].background, // Apply the background color
                        },
                    })
                ),
            ],
        });
        tableRows.push(headerRow);

        // Iterate over each dimension in the data
        if (Array.isArray(data.dimensions)) {
            // Handle dimensions
            data.dimensions.forEach((dimension) => {
                if (dimension.userProgress && Array.isArray(dimension.userProgress.levelCoveragePercent)) {
                    const rowCells = [
                        new TableCell({
                            children: [
                                new Paragraph({
                                    text: dimension.name,
                                    alignment: AlignmentType.CENTER,
                                }),
                            ],
                            margins: { top: 100, bottom: 100, left: 100, right: 100 },
                            verticalAlign: "center",
                            shading: {
                                fill: colors.lightGrey,
                            },
                        }),
                        ...dimension.userProgress.levelCoveragePercent.map((levelObject, index) => {
                            const percentage = levelObject[index + 1] || 0;
                            let cellContent = `${percentage}%`;
                            let shadingColor = colors.lightGrey;

                            if (percentage === 100) {
                                cellContent = "✔";
                                shadingColor = baseGreenColor;
                            } else if (percentage === 0) {
                                cellContent = "-";
                            } else {
                                // Blend the base green color with white based on the percentage
                                const blendedColor = blendColor(baseGreenColor, percentage / 100);
                                shadingColor = blendedColor;
                            }

                            return new TableCell({
                                children: [
                                    new Paragraph({
                                        text: cellContent,
                                        alignment: AlignmentType.CENTER,
                                    }),
                                ],
                                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                                verticalAlign: "center",
                                shading: {
                                    fill: shadingColor,
                                },
                            });
                        }),
                    ];
                    tableRows.push(
                        new TableRow({
                            children: rowCells,
                        })
                    );
                }
            });
        } else if (data.userProgress && Array.isArray(data.userProgress.levelCoveragePercent)) {
            // Handle a single activity or dimension
            const rowCells = [
                new TableCell({
                    children: [
                        new Paragraph({
                            text: data.title || data.name || "Activity Name",
                            alignment: AlignmentType.CENTER,
                        }),
                    ],
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                    verticalAlign: "center",
                    shading: {
                        fill: colors.lightGrey,
                    },
                }),
                ...data.userProgress.levelCoveragePercent.map((levelObject, index) => {
                    const percentage = levelObject[index + 1] || 0;
                    let cellContent = `${percentage}%`;
                    let shadingColor = colors.lightGrey;

                    if (percentage === 100) {
                        cellContent = "✔";
                        shadingColor = baseGreenColor;
                    } else if (percentage === 0) {
                        cellContent = "-";
                    } else {
                        // Blend the base green color with white based on the percentage
                        const blendedColor = blendColor(baseGreenColor, percentage / 100);
                        shadingColor = blendedColor;
                    }

                    return new TableCell({
                        children: [
                            new Paragraph({
                                text: cellContent,
                                alignment: AlignmentType.CENTER,
                            }),
                        ],
                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                        verticalAlign: "center",
                        shading: {
                            fill: shadingColor,
                        },
                    });
                }),
            ];
            tableRows.push(
                new TableRow({
                    children: rowCells,
                })
            );
        } else {
            // Handle cases where userProgress or levelCoveragePercent is not defined
            tableRows.push(
                new TableRow({
                    children: [
                        new TableCell({
                            children: [
                                new Paragraph({
                                    text: data.name || "No data available",
                                    alignment: AlignmentType.CENTER,
                                }),
                            ],
                            columnSpan: levelKeys.length + 1, // Span the entire row
                            margins: { top: 100, bottom: 100, left: 100, right: 100 },
                            verticalAlign: "center",
                            shading: {
                                fill: colors.lightGrey,
                            },
                        }),
                    ],
                })
            );
        }
    } catch (err) {
        console.log(err);
    }

    return new Table({
        rows: tableRows,
        width: {
            size: 100,
            type: WidthType.PERCENTAGE,
        },
    });
}

function createActivityQuestionsTables(activity, levelKeys) {
    if (!activity.userProgress) {
        return [
            new Paragraph({
                text: "No Data",
                alignment: AlignmentType.CENTER,
                shading: {
                    type: ShadingType.CLEAR,
                    fill: colors.lightGrey,
                },
                spacing: {
                    before: 200,
                    after: 200,
                },
            })
        ];
    }

    const levelColors = {
        1: colors.level1.background, // Initial -- red
        2: colors.level2.background, // Repeatable -- orange
        3: colors.level3.background, // Defined -- green
        4: colors.level4.background, // Managed -- light blue
        5: colors.level5.background  // Optimising -- blue
    };

    const paddingSize = 100; // Size in twips (1/20 of a point)

    const createTableRows = (statements) => {
        return statements.map(statement => {
            const level = statement.associatedLevel;
            const levelColor = levelColors[level] || colors.lightGrey; // Default to light grey if no level color

            const cells = [
                new TableCell({
                    children: [new Paragraph({
                        children: [
                            new TextRun( {
                                text: levelKeys[level - 1],
                                color: "FFFFFF",
                            })
                        ],
                    })],
                    shading: {
                        fill: levelColor,
                    },
                    margins: {
                        top: paddingSize,
                        bottom: paddingSize,
                        left: paddingSize,
                        right: paddingSize,
                    },
                    verticalAlign: "center",
                }),
                new TableCell({
                    children: [new Paragraph(statement.text)],
                    margins: {
                        top: paddingSize,
                        bottom: paddingSize,
                        left: paddingSize,
                        right: paddingSize,
                    },
                    verticalAlign: "center",
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            text: statement.userAnswer
                                ? (statement.userAnswer.answer === statement.positive ? "✔" : "✗")
                                : "-",
                            alignment: AlignmentType.CENTER, // Center the text in the paragraph
                        }),
                    ],
                    margins: {
                        top: paddingSize,
                        bottom: paddingSize,
                        left: paddingSize,
                        right: paddingSize,
                    },
                    verticalAlign: "center", // Ensure the content is vertically centered
                }),
                new TableCell({
                    children: [new Paragraph(statement.userAnswer && statement.userAnswer.notes ? statement.userAnswer.notes : "-")],
                    margins: {
                        top: paddingSize,
                        bottom: paddingSize,
                        left: paddingSize,
                        right: paddingSize,
                    },
                    verticalAlign: "center",
                }),
            ];

            return new TableRow({ children: cells });
        });
    };

    // Function to create a complete table with a heading and rows
    const createTableWithHeading = (headingText, rows) => {
        const heading = new Paragraph({
            text: headingText,
            heading: "Heading4",
        });

        const headerRow = new TableRow({
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            text: "Level",
                            alignment: AlignmentType.CENTER, // Center the text in the paragraph
                        }),
                    ],
                    shading: {
                        fill: colors.lightGrey,
                    },
                    verticalAlign: "center",
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            text: "Question",
                            alignment: AlignmentType.CENTER, // Center the text in the paragraph
                        }),
                    ],
                    shading: {
                        fill: colors.lightGrey,
                    },
                    verticalAlign: "center",
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            text: "Achieved",
                            alignment: AlignmentType.CENTER, // Center the text in the paragraph
                        }),
                    ],
                    shading: {
                        fill: colors.lightGrey,
                    },
                    verticalAlign: "center",
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            text: "Notes",
                            alignment: AlignmentType.CENTER, // Center the text in the paragraph
                        }),
                    ],
                    shading: {
                        fill: colors.lightGrey,
                    },
                    verticalAlign: "center",
                }),
            ],
        });

        const table = new Table({
            rows: [headerRow, ...rows],
            width: {
                size: 100,
                type: WidthType.PERCENTAGE,
            },
        });

        return [heading, table];
    };

    // Filter statements by level
    const currentLevelStatements = activity.statements.filter(statement => statement.associatedLevel === activity.userProgress.achievedLevel);
    const nextLevelStatements = activity.statements.filter(statement => statement.associatedLevel === activity.userProgress.achievedLevel + 1);
    const higherLevelStatements = activity.statements.filter(statement =>
        statement.associatedLevel > activity.userProgress.achievedLevel + 1 &&
        (statement.userAnswer && (statement.userAnswer.answer !== undefined || statement.userAnswer.notes))
    );

    // Create tables for each level
    const currentLevelTable = createTableWithHeading("Current state at achieved level", createTableRows(currentLevelStatements));
    const nextLevelTable = createTableWithHeading("Progress towards next level", createTableRows(nextLevelStatements));
    const higherLevelTable = createTableWithHeading("Answers/Notes from higher levels", createTableRows(higherLevelStatements));

    // Return all tables combined
    return [
        ...currentLevelTable,
        ...nextLevelTable,
        ...higherLevelTable,
    ];
}

function checkFileExists(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return true;
        } else {
            console.error(`File does not exist: ${filePath}`);
            return false;
        }
    } catch (err) {
        console.error(`Error checking file existence: ${err}`);
        return false;
    }
}

function getOrdinalSuffix(day) {
    if (day >= 11 && day <= 13) {
        return "th";
    }
    switch (day % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
    }
}

function getPublicationDate() {
    const today = new Date();
    const day = today.getDate();
    const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
    const monthIndex = today.getMonth();
    const year = today.getFullYear();
    const formattedDate = `${day}${getOrdinalSuffix(day)} ${monthNames[monthIndex]} ${year}`;
    return formattedDate;
}

function getPublicationYear() {
    const today = new Date();
    const year = today.getFullYear();
    const formattedDate = `${year}`;
    return formattedDate;
}

async function generateDocxReport(projectData,owner,template = "template") {
    let levelKeys = ["Initial", "Repeatable", "Defined", "Managed", "Optimising"];

    // Create sections
    const metadataSection = createMetadataSection(projectData);
    const summarySection = createExecutiveSummary(projectData);
    const maturitySection = createMaturitySection(projectData.assessmentData, levelKeys);
    const heatmapSection = createHeatmapSection(projectData.assessmentData, levelKeys);
    const dimensionSections = projectData.assessmentData.dimensions.flatMap((dimension, dimensionIndex) =>
        createDimensionSection(dimension, levelKeys, dimensionIndex)
    );
    let filePath = "./private/assessments/"+template+".docx";
    if (!checkFileExists(filePath)) {
        filePath = "./private/assessments/template.docx";
    }
    if (checkFileExists(filePath)) {
        try {
            const { path: tempFilePath } = await tmp.file();
            const doc = await patchDocument(fs.readFileSync(filePath), {
                outputType: "nodebuffer",
                features: {
                    updateFields: true,
                },
                patches: {
                    doctitle: {
                        type: PatchType.PARAGRAPH,
                        children: [
                            new TextRun( {
                                text: projectData.title,
                                size: 60,
                                color: "FFFFFF",
                            })
                        ]
                    },
                    author: {
                        type: PatchType.PARAGRAPH,
                        children: [
                            new TextRun(owner.name + " (" + owner.email + ")")
                        ]
                    },
                    footertitle: {
                        type: PatchType.PARAGRAPH,
                        children: [
                            new TextRun(projectData.title)
                        ]
                    },
                    date: {
                        type: PatchType.PARAGRAPH,
                        children: [
                            new TextRun( {
                                text: getPublicationDate(),
                                color: "FFFFFF",
                            })
                        ]
                    },
                    footerdate: {
                        type: PatchType.PARAGRAPH,
                        children: [
                            new TextRun( {
                                text: getPublicationYear(),
                            })
                        ]
                    },
                    content: {
                        type: PatchType.DOCUMENT,
                        children: [
                            ...summarySection,
                            ...maturitySection,
                            ...heatmapSection,
                            ...dimensionSections,
                        ]
                    }
                }
            });
            fs.writeFileSync(tempFilePath, doc);

            return tempFilePath;
        } catch (err) {
            console.log("Error creating docx:", err);
            throw err; // Rethrow the error to be handled elsewhere
        }
    }
}

/*
    // Combine all sections into one document
    const doc = new Document({
        styles: {
            paragraphStyles: [
                {
                    id: "Title",
                    name: "Title",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: "Helvetica",
                        size: 48, // 24pt
                        bold: false,
                        color: colors.darkblue,
                    },
                    paragraph: {
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 },
                    },
                },
                {
                    id: "Heading1",
                    name: "Heading 1",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: "Helvetica",
                        size: 36, // 18pt
                        bold: true,
                        color: colors.darkblue,
                    },
                    paragraph: {
                        spacing: { before: 500, after: 300 },
                    },
                },
                {
                    id: "Heading2",
                    name: "Heading 2",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: "Helvetica",
                        size: 32, // 16pt
                        bold: true,
                        color: colors.darkblue,
                    },
                    paragraph: {
                        spacing: { before: 500, after: 300 },
                    },
                },
                {
                    id: "Heading2",
                    name: "Heading 2",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: {
                        font: "Helvetica",
                        size: 28, // 16pt
                        bold: true,
                        color: colors.darkblue,
                    },
                    paragraph: {
                        spacing: { before: 300, after: 200 },
                    },
                },
                {
                    id: "Normal",
                    name: "Normal",
                    quickFormat: true,
                    run: {
                        font: "Helvetica",
                        size: 24, // 12pt
                    },
                    paragraph: {
                        spacing: { before: 200, after: 200 },
                    },
                },
            ],
        },
        sections: [
            {
                properties: {},
                children: [
                    ...metadataSection,
                    ...maturitySection,
                    ...heatmapSection,
                    ...dimensionSections,
                ],
            },
        ],
    });


    return doc;
}
    */

module.exports = { generateDocxReport };
