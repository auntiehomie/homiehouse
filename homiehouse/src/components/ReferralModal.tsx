import React, { useState } from 'react';

const ReferralModal = () => {
    const [email, setEmail] = useState('');

    const handleInvite = () => {
        // Logic for sending the referral invite goes here.
        console.log(`Invite sent to: ${email}`);
        // Reset input
        setEmail('');
    };

    return (
        <div className="referral-modal">
            <h2>Invite a Friend</h2>
            <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="Enter friend's email"
            />
            <button onClick={handleInvite}>Send Invite</button>
        </div>
    );
};

export default ReferralModal;