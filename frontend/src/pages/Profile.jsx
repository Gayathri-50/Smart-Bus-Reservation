import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const loggedUser = JSON.parse(localStorage.getItem('user')) || {};
const Profile = () => {
  const navigate = useNavigate();
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const [userProfile, setUserProfile] = useState({
    firstName: loggedUser.name?.split(' ')[0] || '',
    lastName: loggedUser.name?.split(' ').slice(1).join(' ') || '',
    email: loggedUser.email || '',
    phone: loggedUser.phone || '',
    guardianName: loggedUser.guardian?.name || '',
    guardianPhone: loggedUser.guardian?.phone || '',
    guardianEmail: loggedUser.guardian?.email || '',
    guardianRelationship: loggedUser.guardian?.relationship || 'Parent / Guardian',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    dateOfBirth: '',
    gender: '',
  });

  const [formData, setFormData] = useState({ ...userProfile });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [passwordErrors, setPasswordErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [successFeedback, setSuccessFeedback] = useState('');
  const [bookings, setBookings] = useState(() =>
    JSON.parse(localStorage.getItem('bookings')) || []
  );

  useEffect(() => {
    const fetchProfileAndBookings = async () => {
      try {
        const [profileRes, bookingsRes] = await Promise.all([
          api.get('/auth/profile').catch(() => null),
          api.get('/bookings').catch(() => null),
        ]);

        if (profileRes?.data) {
          const u = profileRes.data.user || profileRes.data;
          const names = (u.name || '').split(' ');
          const fName = names[0] || '';
          const lName = names.slice(1).join(' ') || '';
          const profileData = {
            firstName: fName,
            lastName: lName,
            email: u.email || '',
            phone: u.phone || '',
            guardianName: u.guardian?.name || '',
            guardianPhone: u.guardian?.phone || '',
            guardianEmail: u.guardian?.email || '',
            guardianRelationship: u.guardian?.relationship || 'Parent / Guardian',
          };
          setUserProfile((prev) => ({ ...prev, ...profileData }));
          setFormData((prev) => ({ ...prev, ...profileData }));
        }

        if (bookingsRes?.data && Array.isArray(bookingsRes.data)) {
          setBookings(bookingsRes.data);
        }
      } catch (err) {
        console.error('Error fetching profile data', err);
      }
    };

    fetchProfileAndBookings();
  }, []);

  // Helper functions for account info
  const getAccountStatus = () => {
    if (bookings.length === 0) return 'New Member';
    const hasCompleted = bookings.some(b => b.status === 'completed');
    return hasCompleted ? 'Active' : 'Inactive';
  };

  const getLastBookingDate = () => {
    if (bookings.length === 0) return 'N/A';
    const lastBooking = bookings[bookings.length - 1];
    if (lastBooking.departureDate) {
      return new Date(lastBooking.departureDate).toLocaleDateString();
    }
    return 'N/A';
  };

  const getPreferredRoute = () => {
    if (bookings.length === 0) return 'N/A';
    const routes = bookings.reduce((acc, booking) => {
      const route = booking.route || 'Unknown';
      acc[route] = (acc[route] || 0) + 1;
      return acc;
    }, {});
    const preferred = Object.entries(routes).sort((a, b) => b[1] - a[1])[0];
    return preferred ? preferred[0] : 'N/A';
  };

  const getRegistrationDate = () => {
    if (loggedUser.createdAt) {
      return new Date(loggedUser.createdAt).toLocaleDateString();
    }
    return new Date().toLocaleDateString();
  };

  const totalBookings = bookings.length;

  const completedTrips = bookings.filter(
    booking => booking.status === "completed"
  ).length;

  const cancelledBookings = bookings.filter(
    booking => booking.status === "cancelled"
  ).length;

  const loyaltyPoints = completedTrips * 100;

  const accountStats = [
    {
      label: 'Total Bookings',
      value: totalBookings,
      icon: '🎫',
    },
    {
      label: 'Completed Trips',
      value: completedTrips,
      icon: '✅',
    },
    {
      label: 'Cancelled Bookings',
      value: cancelledBookings,
      icon: '❌',
    },
    {
      label: 'Loyalty Points',
      value: loyaltyPoints,
      icon: '⭐',
    },
  ];

  const today = new Date().toISOString().split('T')[0];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'dateOfBirth' && formError) {
      setFormError('');
    }
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData({
      ...passwordData,
      [name]: value,
    });
    setPasswordErrors({ ...passwordErrors, [name]: '' });
  };

  const handleSaveProfile = async () => {
    if (formData.dateOfBirth && formData.dateOfBirth > today) {
      setFormError('Date of birth cannot be in the future');
      return;
    }

    setFormError('');
    try {
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();
      const res = await api.put('/auth/profile', {
        name: fullName,
        phone: formData.phone,
        guardian: {
          name: formData.guardianName,
          phone: formData.guardianPhone,
          email: formData.guardianEmail,
          relationship: formData.guardianRelationship,
        },
      });

      if (res.data?.user) {
        localStorage.setItem('user', JSON.stringify(res.data.user));
        window.dispatchEvent(new Event('authChange'));
      }

      setUserProfile({ ...formData });
      setIsEditMode(false);
      setSuccessFeedback('✓ Profile and Guardian details updated successfully!');
      setTimeout(() => setSuccessFeedback(''), 5000);
    } catch (err) {
      console.error('Failed to save profile', err);
      setFormError(err.response?.data?.message || 'Failed to update profile.');
    }
  };

  const handleCancelEdit = () => {
    setFormData({ ...userProfile });
    setIsEditMode(false);
  };

  const handleChangePassword = async () => {
    const errors = {};

    if (!passwordData.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }
    if (!passwordData.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (passwordData.newPassword.length < 8) {
      errors.newPassword = 'Password must be at least 8 characters';
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    try {
      await api.put('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      setSuccessFeedback('✓ Account password changed successfully!');
      setTimeout(() => setSuccessFeedback(''), 5000);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordErrors({});
      setShowPasswordForm(false);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to change password. Please check your current password.';
      setPasswordErrors({ currentPassword: msg });
    }
  };

  return (
    <div className="profile-page-shell">
      {successFeedback && (
        <div className="admin-alert-banner success" style={{ maxWidth: '1240px', margin: '0 auto 1.5rem' }}>
          <span>{successFeedback}</span>
          <button
            type="button"
            onClick={() => setSuccessFeedback('')}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '4px' }}
          >
            ✕
          </button>
        </div>
      )}

      <div className="profile-hero-card">
        <div className="profile-hero-content">
          <div className="profile-avatar-ring">
            <span className="avatar-icon">👤</span>
          </div>
          <div className="profile-header-info">
            <p className="profile-eyebrow">Member dashboard</p>
            <h1>{userProfile.firstName} {userProfile.lastName}</h1>
            <p>{userProfile.email}</p>
          </div>
        </div>
        <button className="profile-action-btn" onClick={() => navigate('/booking-history')}>View booking history</button>
      </div>

      <div className="profile-wrapper">
        <div className="profile-stats">
          {accountStats.map((stat, index) => (
            <div key={index} className="stat-card">
              <div className="stat-icon">{stat.icon}</div>
              <div className="stat-info">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="profile-tabs">
          <div className="tabs-header">
            <button
              className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('profile');
                setIsEditMode(false);
              }}
            >
              👤 Personal Info
            </button>
            <button
              className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('settings');
                setShowPasswordForm(false);
              }}
            >
              ⚙️ Settings
            </button>
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="tab-content">
              {!isEditMode ? (
                <div className="profile-view">
                  <div className="profile-section">
                    <h2>Personal Information</h2>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="info-label">First Name</span>
                        <span className="info-value">{userProfile.firstName}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Last Name</span>
                        <span className="info-value">{userProfile.lastName}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Email</span>
                        <span className="info-value">{userProfile.email}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Phone</span>
                        <span className="info-value">{userProfile.phone}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Date of Birth</span>
                        <span className="info-value">{userProfile.dateOfBirth}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Gender</span>
                        <span className="info-value">{userProfile.gender}</span>
                      </div>
                    </div>
                  </div>

                  <div className="profile-section">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <h2 style={{ margin: 0 }}>Guardian / Safety Contact</h2>
                      <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                        🛡️ Safety Notifications
                      </span>
                    </div>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="info-label">Guardian Name</span>
                        <span className="info-value">{userProfile.guardianName || 'Not configured'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Guardian Email</span>
                        <span className="info-value">{userProfile.guardianEmail || 'Not configured'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Guardian Mobile</span>
                        <span className="info-value">{userProfile.guardianPhone || 'Not configured'}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Relationship</span>
                        <span className="info-value">{userProfile.guardianRelationship || 'Parent / Guardian'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="profile-section">
                    <h2>Account Information</h2>
                    <div className="info-grid">
                      <div className="info-item">
                        <span className="info-label">Member Since</span>
                        <span className="info-value">{getRegistrationDate()}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Last Booking</span>
                        <span className="info-value">{getLastBookingDate()}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Preferred Route</span>
                        <span className="info-value">{getPreferredRoute()}</span>
                      </div>
                      <div className="info-item">
                        <span className="info-label">Account Status</span>
                        <span className="info-value">{getAccountStatus()}</span>
                      </div>
                    </div>
                  </div>

                  <button className="edit-btn" onClick={() => setIsEditMode(true)}>
                    ✏️ Edit Profile
                  </button>

                  {/* Recent Activity Section */}
                  <div className="profile-section">
                    <h2>Recent Activity</h2>
                    {bookings.length === 0 ? (
                      <p className="no-activity">No bookings yet. Start your journey with us!</p>
                    ) : (
                      <div className="activity-list">
                        {bookings.slice().reverse().slice(0, 5).map((booking, index) => (
                          <div key={index} className="activity-item">
                            <div className="activity-icon">
                              {booking.status === 'completed' && '✅'}
                              {booking.status === 'cancelled' && '❌'}
                              {booking.status === 'pending' && '⏳'}
                              {!booking.status && '📍'}
                            </div>
                            <div className="activity-content">
                              <div className="activity-title">{booking.route || `Bus Booking ${booking.busId || 'N/A'}`}</div>
                              <div className="activity-meta">
                                Date: {booking.departureDate ? new Date(booking.departureDate).toLocaleDateString() : 'N/A'} • Status: {booking.status || 'Completed'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="profile-form">
                  <h2>Edit Personal Information</h2>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>First Name</label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>Last Name</label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>Phone</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>Date of Birth</label>
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                        max={today}
                      />
                      {formError && (
                        <span className="error-text">{formError}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Gender</label>
                      <select name="gender" value={formData.gender} onChange={handleInputChange}>
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div className="form-group full-width">
                      <label>Address</label>
                      <textarea
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        rows="3"
                      />
                    </div>
                    <div className="form-group">
                      <label>City</label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>State</label>
                      <input
                        type="text"
                        name="state"
                        value={formData.state}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>ZIP Code</label>
                      <input
                        type="text"
                        name="zipCode"
                        value={formData.zipCode}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Guardian / Safety Contact Information</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
                      Add your guardian's contact details so booking confirmation &amp; travel safety updates reach them automatically.
                    </p>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Guardian Name</label>
                        <input
                          type="text"
                          name="guardianName"
                          value={formData.guardianName}
                          onChange={handleInputChange}
                          placeholder="e.g. Ramesh Kumar"
                        />
                      </div>
                      <div className="form-group">
                        <label>Guardian Email</label>
                        <input
                          type="email"
                          name="guardianEmail"
                          value={formData.guardianEmail}
                          onChange={handleInputChange}
                          placeholder="guardian@example.com"
                        />
                      </div>
                      <div className="form-group">
                        <label>Guardian Mobile</label>
                        <input
                          type="text"
                          name="guardianPhone"
                          value={formData.guardianPhone}
                          onChange={handleInputChange}
                          placeholder="e.g. 9876543210"
                        />
                      </div>
                      <div className="form-group">
                        <label>Relationship</label>
                        <input
                          type="text"
                          name="guardianRelationship"
                          value={formData.guardianRelationship}
                          onChange={handleInputChange}
                          placeholder="e.g. Parent, Guardian, Spouse"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button className="save-btn" onClick={handleSaveProfile}>
                      ✅ Save Changes
                    </button>
                    <button className="cancel-btn" onClick={handleCancelEdit}>
                      ❌ Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="tab-content">
              <div className="settings-section">
                <h2>Account Settings</h2>

                {!showPasswordForm ? (
                  <div className="settings-option">
                    <div className="setting-info">
                      <h3>Change Password</h3>
                      <p>Update your password to keep your account secure</p>
                    </div>
                    <button
                      className="change-password-btn"
                      onClick={() => setShowPasswordForm(true)}
                    >
                      🔐 Change Password
                    </button>
                  </div>
                ) : (
                  <div className="password-form">
                    <h3>Change Password</h3>
                    <div className="form-group">
                      <label>Current Password</label>
                      <input
                        type="password"
                        name="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        placeholder="Enter your current password"
                      />
                      {passwordErrors.currentPassword && (
                        <span className="error-text">{passwordErrors.currentPassword}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label>New Password</label>
                      <input
                        type="password"
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        placeholder="Enter new password (min 8 characters)"
                      />
                      {passwordErrors.newPassword && (
                        <span className="error-text">{passwordErrors.newPassword}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Confirm Password</label>
                      <input
                        type="password"
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        placeholder="Re-enter new password"
                      />
                      {passwordErrors.confirmPassword && (
                        <span className="error-text">{passwordErrors.confirmPassword}</span>
                      )}
                    </div>

                    <div className="form-actions">
                      <button className="save-btn" onClick={handleChangePassword}>
                        ✅ Update Password
                      </button>
                      <button
                        className="cancel-btn"
                        onClick={() => {
                          setShowPasswordForm(false);
                          setPasswordData({
                            currentPassword: '',
                            newPassword: '',
                            confirmPassword: '',
                          });
                          setPasswordErrors({});
                        }}
                      >
                        ❌ Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="settings-section">
                  <h3>Preferences</h3>
                  <div className="preference-item">
                    <label>
                      <input type="checkbox" defaultChecked />
                      <span>Receive booking confirmations via email</span>
                    </label>
                  </div>
                  <div className="preference-item">
                    <label>
                      <input type="checkbox" defaultChecked />
                      <span>Receive promotional offers</span>
                    </label>
                  </div>
                  <div className="preference-item">
                    <label>
                      <input type="checkbox" />
                      <span>Receive SMS notifications</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
