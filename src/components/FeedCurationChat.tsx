"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface FeedCurationChatProps {
  onClose: () => void;
}

export default function FeedCurationChat({ onClose }: FeedCurationChatProps) {
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState("");

  useEffect(() => {
    // Load saved interests from localStorage
    const saved = localStorage.getItem('hh_feed_interests');
    if (saved) {
      try {
        setInterests(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load interests:', e);
      }
    }
  }, []);

  const saveInterests = (newInterests: string[]) => {
    setInterests(newInterests);
    localStorage.setItem('hh_feed_interests', JSON.stringify(newInterests));
  };

  const addInterest = () => {
    const interest = newInterest.trim();
    if (interest && !interests.includes(interest.toLowerCase())) {
      saveInterests([...interests, interest.toLowerCase()]);
      setNewInterest("");
    }
  };

  const removeInterest = (interest: string) => {
    saveInterests(interests.filter(i => i !== interest));
  };

  const quickInterests = [
    "crypto", "nft", "art", "trading", "tech", "defi",
    "base", "ethereum", "politics", "memes", "music", "gaming"
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '85vh',
          overflow: 'auto',
          border: '1px solid var(--border)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Customize Your Feed</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--foreground)',
              padding: '4px 8px'
            }}
          >
            ×
          </button>
        </div>

        <p style={{ color: 'var(--muted-on-dark)', marginBottom: '24px', lineHeight: 1.5 }}>
          Tell us what you're interested in, and we'll personalize your feed to show more of what you care about.
        </p>

        {/* Your Interests */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Your Interests</h3>
          
          {interests.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {interests.map(interest => (
                <div
                  key={interest}
                  style={{
                    background: 'var(--accent)',
                    color: 'white',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>#{interest}</span>
                  <button
                    onClick={() => removeInterest(interest)}
                    style={{
                      background: 'rgba(255,255,255,0.3)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: 'white'
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--muted-on-dark)', fontSize: '14px', marginBottom: '16px' }}>
              No interests added yet. Add some below to personalize your feed.
            </p>
          )}

          {/* Add Interest */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addInterest();
                }
              }}
              placeholder="Add an interest (e.g., crypto, art)"
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--background)',
                color: 'var(--foreground)',
                fontSize: '14px'
              }}
            />
            <button
              onClick={addInterest}
              className="btn primary"
              style={{ fontSize: '14px', padding: '10px 20px' }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Quick Add */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Quick Add</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {quickInterests
              .filter(q => !interests.includes(q))
              .map(interest => (
                <button
                  key={interest}
                  onClick={() => saveInterests([...interests, interest])}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--accent)';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.borderColor = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--foreground)';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  #{interest}
                </button>
              ))}
          </div>
        </div>

        {/* Ask Homie */}
        <div style={{ 
          background: 'rgba(232, 119, 34, 0.1)', 
          border: '1px solid var(--accent)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '24px' }}>🏠</span>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Need Help?</h3>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--muted-on-dark)', marginBottom: '12px', lineHeight: 1.5 }}>
            Not sure what to add? Chat with @homiehouse for personalized recommendations based on your activity.
          </p>
          <Link href="/ask-homie">
            <button
              className="btn primary"
              style={{ fontSize: '14px', width: '100%' }}
            >
              Chat with @homiehouse
            </button>
          </Link>
        </div>

        {/* Info */}
        <div style={{ 
          fontSize: '13px', 
          color: 'var(--muted-on-dark)',
          padding: '12px',
          background: 'var(--background)',
          borderRadius: '8px',
          lineHeight: 1.5
        }}>
          <strong>How it works:</strong> Your feed will prioritize casts that mention your interests. 
          The more interests you add, the more personalized your feed becomes. You can always come back and adjust these.
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="btn"
          style={{ width: '100%', marginTop: '16px' }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
