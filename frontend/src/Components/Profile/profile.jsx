import React, { useState } from 'react';
import { Pencil, Mail, User, Shield } from 'lucide-react';

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState({
    name: 'Charlie Chung',
    email: 'charlie@guardianfueltech.com',
    role: 'Hiring Manager'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    setIsEditing(false);
    // Here you'd persist the data via API
    console.log('Saved profile:', profile);
  };

  return (
    <div className="max-w-md mx-auto mt-20 bg-white shadow-xl rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Profile</h2>
        <button onClick={() => setIsEditing(!isEditing)} className="text-blue-600 hover:text-blue-800">
          <Pencil size={18} />
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <User className="text-gray-500" size={20} />
          {isEditing ? (
            <input
              type="text"
              name="name"
              value={profile.name}
              onChange={handleChange}
              className="border border-gray-300 rounded px-2 py-1 w-full"
            />
          ) : (
            <p className="text-gray-800">{profile.name}</p>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <Mail className="text-gray-500" size={20} />
          {isEditing ? (
            <input
              type="email"
              name="email"
              value={profile.email}
              onChange={handleChange}
              className="border border-gray-300 rounded px-2 py-1 w-full"
            />
          ) : (
            <p className="text-gray-800">{profile.email}</p>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <Shield className="text-gray-500" size={20} />
          {isEditing ? (
            <select
              name="role"
              value={profile.role}
              onChange={handleChange}
              className="border border-gray-300 rounded px-2 py-1 w-full"
            >
              <option value="Hiring Manager">Hiring Manager</option>
              <option value="Field Employee">Field Employee</option>
              <option value="Admin">Admin</option>
            </select>
          ) : (
            <p className="text-gray-800">{profile.role}</p>
          )}
        </div>

        {isEditing && (
          <button
            onClick={handleSave}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
          >
            Save Changes
          </button>
        )}
      </div>
    </div>
  );
}
