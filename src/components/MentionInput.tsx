'use client';

import { useState, useEffect, useRef } from 'react';

interface User {
  fid: number;
  username: string;
  display_name: string;
  pfp_url?: string;
  follower_count?: number;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onUserSelect?: (user: User) => void;
}

export default function MentionInput({ 
  value, 
  onChange, 
  placeholder = 'Type @ to mention a user',
  className = '',
  onUserSelect
}: MentionInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Detect @ mention in text
  useEffect(() => {
    const cursorPosition = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      const hasSpace = textAfterAt.includes(' ');
      
      if (!hasSpace && textAfterAt.length >= 1) {
        setSearchQuery(textAfterAt);
        setShowDropdown(true);
      } else {
        setShowDropdown(false);
      }
    } else {
      setShowDropdown(false);
    }
  }, [value]);

  // Search users when query changes
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 1) {
      setUsers([]);
      return;
    }

    const searchUsers = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
        const data = await response.json();
        setUsers(data.users || []);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Failed to search users:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Handle user selection
  const selectUser = (user: User) => {
    const cursorPosition = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    const newValue = 
      value.slice(0, lastAtIndex) + 
      `@${user.username} ` + 
      textAfterCursor;
    
    onChange(newValue);
    setShowDropdown(false);
    onUserSelect?.(user);
    
    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
      const newPosition = lastAtIndex + user.username.length + 2;
      inputRef.current?.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown && users.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % users.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + users.length) % users.length);
        return;
      } else if (e.key === 'Enter' && users[selectedIndex]) {
        e.preventDefault();
        selectUser(users[selectedIndex]);
        return;
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
        return;
      }
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />
      
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {loading ? (
            <div className="p-3 text-center text-gray-400 text-sm">
              Searching...
            </div>
          ) : users.length === 0 ? (
            <div className="p-3 text-center text-gray-400 text-sm">
              No users found
            </div>
          ) : (
            users.map((user, index) => (
              <button
                key={user.fid}
                onClick={() => selectUser(user)}
                className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-800 transition-colors ${
                  index === selectedIndex ? 'bg-gray-800' : ''
                }`}
              >
                {user.pfp_url && (
                  <img 
                    src={user.pfp_url} 
                    alt={user.username}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <div className="flex-1 text-left">
                  <div className="text-white font-medium">{user.display_name}</div>
                  <div className="text-gray-400 text-sm">@{user.username}</div>
                </div>
                {user.follower_count !== undefined && (
                  <div className="text-gray-500 text-xs">
                    {user.follower_count.toLocaleString()} followers
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
