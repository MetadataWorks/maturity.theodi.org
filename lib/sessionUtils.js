const { MongoClient } = require("mongodb");

async function deleteUserSessions(userId) {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const db = client.db(process.env.MONGO_DB);
    const sessions = db.collection("sessions");
    const userIdStr = userId.toString();
    const allSessions = await sessions
      .find({ session: { $regex: userIdStr } })
      .toArray();

    for (const sess of allSessions) {
      try {
        const parsed = JSON.parse(sess.session);
        if (parsed.userId === userIdStr) {
          await sessions.deleteOne({ _id: sess._id });
          console.log(`✅ Deleted session ${sess._id} for user ${userIdStr}`);
        }
      } catch (e) {
        console.error("❌ Error parsing session JSON:", e);
      }
    }
  } catch (err) {
    console.error("❌ Error deleting user sessions:", err);
  } finally {
    await client.close();
  }
}

module.exports = { deleteUserSessions };
