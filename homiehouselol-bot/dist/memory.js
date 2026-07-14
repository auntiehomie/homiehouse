import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'memory.db');
class Memory {
    db = null;
    initialized = false;
    async init() {
        if (this.initialized)
            return;
        const SQL = await initSqlJs();
        // Try to load existing database
        try {
            const buffer = await fs.readFile(DB_PATH);
            this.db = new SQL.Database(buffer);
        }
        catch {
            // Create new database
            this.db = new SQL.Database();
        }
        this.initDatabase();
        this.initialized = true;
    }
    initDatabase() {
        if (!this.db)
            return;
        // Conversations table - stores all interactions
        this.db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_fid INTEGER NOT NULL,
        username TEXT NOT NULL,
        cast_hash TEXT UNIQUE NOT NULL,
        user_message TEXT NOT NULL,
        bot_reply TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);
        // User profiles - tracks who we talk to
        this.db.run(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        fid INTEGER PRIMARY KEY,
        username TEXT NOT NULL,
        display_name TEXT,
        topics TEXT DEFAULT '[]',
        posting_style TEXT DEFAULT '{}',
        last_interaction INTEGER NOT NULL,
        interaction_count INTEGER DEFAULT 1
      )
    `);
        // Indexes for faster queries
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_user_fid ON conversations(user_fid)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_user_profiles_last_interaction ON user_profiles(last_interaction)`);
    }
    async saveToFile() {
        if (!this.db)
            return;
        const data = this.db.export();
        await fs.writeFile(DB_PATH, data);
    }
    // Store a new conversation
    async storeConversation(userFid, username, castHash, userMessage, botReply) {
        if (!this.db)
            return;
        const timestamp = Date.now();
        // Store conversation
        this.db.run(`INSERT OR REPLACE INTO conversations 
      (user_fid, username, cast_hash, user_message, bot_reply, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)`, [userFid, username, castHash, userMessage, botReply, timestamp]);
        // Update user profile
        this.db.run(`INSERT INTO user_profiles (fid, username, last_interaction, interaction_count)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(fid) DO UPDATE SET
        username = excluded.username,
        last_interaction = excluded.last_interaction,
        interaction_count = interaction_count + 1`, [userFid, username, timestamp]);
        await this.saveToFile();
    }
    // Get recent conversations with a specific user
    getUserHistory(userFid, limit = 5) {
        if (!this.db)
            return [];
        const stmt = this.db.prepare(`
      SELECT * FROM conversations
      WHERE user_fid = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
        stmt.bind([userFid, limit]);
        const results = [];
        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push(row);
        }
        stmt.free();
        return results;
    }
    // Get all recent conversations (for context)
    getRecentConversations(limit = 10) {
        if (!this.db)
            return [];
        const stmt = this.db.prepare(`
      SELECT * FROM conversations
      ORDER BY timestamp DESC
      LIMIT ?
    `);
        stmt.bind([limit]);
        const results = [];
        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push(row);
        }
        stmt.free();
        return results;
    }
    // Get user profile
    getUserProfile(userFid) {
        if (!this.db)
            return null;
        const stmt = this.db.prepare(`
      SELECT * FROM user_profiles
      WHERE fid = ?
    `);
        stmt.bind([userFid]);
        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
        }
        stmt.free();
        return null;
    }
    // Update user profile with learned insights
    async updateUserProfile(userFid, username, topics, postingStyle) {
        if (!this.db)
            return;
        const profile = this.getUserProfile(userFid);
        const timestamp = Date.now();
        let updatedTopics = topics ? JSON.stringify(topics) : '[]';
        let updatedStyle = postingStyle ? JSON.stringify(postingStyle) : '{}';
        // Merge with existing data if available
        if (profile) {
            const existingTopics = JSON.parse(profile.topics || '[]');
            const existingStyle = JSON.parse(profile.posting_style || '{}');
            if (topics) {
                const mergedTopics = [...new Set([...existingTopics, ...topics])];
                updatedTopics = JSON.stringify(mergedTopics.slice(-10)); // Keep last 10 topics
            }
            if (postingStyle) {
                updatedStyle = JSON.stringify({ ...existingStyle, ...postingStyle });
            }
        }
        this.db.run(`INSERT INTO user_profiles (fid, username, topics, posting_style, last_interaction, interaction_count)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(fid) DO UPDATE SET
        username = excluded.username,
        topics = excluded.topics,
        posting_style = excluded.posting_style,
        last_interaction = excluded.last_interaction`, [userFid, username, updatedTopics, updatedStyle, timestamp]);
        await this.saveToFile();
    }
    // Search conversations by keyword
    searchConversations(keyword, limit = 5) {
        if (!this.db)
            return [];
        const stmt = this.db.prepare(`
      SELECT * FROM conversations
      WHERE user_message LIKE ? OR bot_reply LIKE ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
        const pattern = `%${keyword}%`;
        stmt.bind([pattern, pattern, limit]);
        const results = [];
        while (stmt.step()) {
            const row = stmt.getAsObject();
            results.push(row);
        }
        stmt.free();
        return results;
    }
    // Get conversation stats
    getStats() {
        if (!this.db)
            return { totalConversations: 0, uniqueUsers: 0, averagePerUser: 0 };
        const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM conversations');
        totalStmt.step();
        const total = totalStmt.getAsObject().count;
        totalStmt.free();
        const usersStmt = this.db.prepare('SELECT COUNT(*) as count FROM user_profiles');
        usersStmt.step();
        const users = usersStmt.getAsObject().count;
        usersStmt.free();
        return {
            totalConversations: total,
            uniqueUsers: users,
            averagePerUser: users > 0 ? Math.round(total / users * 10) / 10 : 0,
        };
    }
    // Clean old conversations (older than 30 days)
    async cleanOldConversations(daysToKeep = 30) {
        if (!this.db)
            return 0;
        const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        this.db.run(`DELETE FROM conversations WHERE timestamp < ?`, [cutoff]);
        await this.saveToFile();
        return this.db.getRowsModified();
    }
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}
// Singleton instance
let memoryInstance = null;
export async function getMemory() {
    if (!memoryInstance) {
        memoryInstance = new Memory();
        await memoryInstance.init();
    }
    return memoryInstance;
}
export function closeMemory() {
    if (memoryInstance) {
        memoryInstance.close();
        memoryInstance = null;
    }
}
