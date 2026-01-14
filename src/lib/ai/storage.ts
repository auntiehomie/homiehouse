import { UserProfile, UserProfileSchema } from './agents';

// In-memory storage (replace with database in production)
const userProfiles = new Map<string, UserProfile>();

export class UserProfileStorage {
  static getProfile(userId: string): UserProfile {
    if (!userProfiles.has(userId)) {
      // Create default profile
      const defaultProfile: UserProfile = {
        writingStyle: 'casual',
        preferredTone: 'friendly',
        topics: [],
        castLength: 'medium',
        useEmojis: true,
        useHashtags: false,
        learningPreferences: {
          previousCasts: [],
          feedbackHistory: [],
          commonPatterns: []
        }
      };
      userProfiles.set(userId, defaultProfile);
    }
    return userProfiles.get(userId)!;
  }

  static updateProfile(userId: string, updates: Partial<UserProfile>): UserProfile {
    const current = this.getProfile(userId);
    const updated = { ...current, ...updates };
    
    // Validate with schema
    const validated = UserProfileSchema.parse(updated);
    userProfiles.set(userId, validated);
    
    return validated;
  }

  static addCast(userId: string, cast: string): void {
    const profile = this.getProfile(userId);
    profile.learningPreferences.previousCasts.push(cast);
    
    // Keep only last 50
    if (profile.learningPreferences.previousCasts.length > 50) {
      profile.learningPreferences.previousCasts.shift();
    }
    
    userProfiles.set(userId, profile);
  }

  static addFeedback(userId: string, cast: string, feedback: string): void {
    const profile = this.getProfile(userId);
    profile.learningPreferences.feedbackHistory.push({
      cast,
      feedback,
      timestamp: Date.now()
    });
    
    // Keep only last 20 feedback items
    if (profile.learningPreferences.feedbackHistory.length > 20) {
      profile.learningPreferences.feedbackHistory.shift();
    }
    
    userProfiles.set(userId, profile);
  }

  static analyzePatterns(userId: string): string[] {
    const profile = this.getProfile(userId);
    const patterns: string[] = [];

    // Analyze cast lengths
    const casts = profile.learningPreferences.previousCasts;
    if (casts.length > 5) {
      const avgLength = casts.reduce((sum, c) => sum + c.length, 0) / casts.length;
      if (avgLength < 100) {
        patterns.push('Tends to write short, concise casts');
      } else if (avgLength > 200) {
        patterns.push('Prefers longer, detailed casts');
      }
    }

    // Analyze emoji usage
    const emojiCount = casts.filter(c => /[\u{1F300}-\u{1F9FF}]/u.test(c)).length;
    if (emojiCount > casts.length / 2) {
      patterns.push('Frequently uses emojis');
    }

    // Analyze question usage
    const questionCount = casts.filter(c => c.includes('?')).length;
    if (questionCount > casts.length / 3) {
      patterns.push('Often asks questions to engage audience');
    }

    // Analyze link usage
    const linkCount = casts.filter(c => /https?:\/\//.test(c)).length;
    if (linkCount > casts.length / 4) {
      patterns.push('Regularly shares links and resources');
    }

    return patterns;
  }

  static getStats(userId: string): {
    totalCasts: number;
    totalFeedback: number;
    patterns: string[];
    recentActivity: Date | null;
  } {
    const profile = this.getProfile(userId);
    const patterns = this.analyzePatterns(userId);
    
    const recentActivity = profile.learningPreferences.feedbackHistory.length > 0
      ? new Date(Math.max(...profile.learningPreferences.feedbackHistory.map(f => f.timestamp)))
      : null;

    return {
      totalCasts: profile.learningPreferences.previousCasts.length,
      totalFeedback: profile.learningPreferences.feedbackHistory.length,
      patterns,
      recentActivity
    };
  }
}
