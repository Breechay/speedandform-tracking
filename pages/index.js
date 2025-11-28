import React, { useState, useEffect } from 'react';
import { TrendingUp, Activity, Heart, Settings, Calendar, Home, LogOut, ChevronDown, X, Check, Upload, Edit2 } from 'lucide-react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY;

const api = {
  async fetch(endpoint, options = {}) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      ...options,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...options.headers
      }
    });
    return response.json();
  }
};

export default function SpeedAndFormPlatform() {
  const [view, setView] = useState('login');
  const [navView, setNavView] = useState('current');
  const [currentUser, setCurrentUser] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [expandedWeek, setExpandedWeek] = useState(null);
  const [editingWeek, setEditingWeek] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('speedandform_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      
      if (user.role === 'coach') {
        loadAthletes();
        setView('coach-dashboard');
      } else {
        loadAthleteProfile(user.athlete_id);
      }
    }
  }, []);

  const loadAthleteProfile = async (athleteId) => {
    const athleteData = await api.fetch(`athletes?id=eq.${athleteId}&select=*`);
    const athlete = athleteData[0];
    setSelectedAthlete(athlete);
    
    if (!athlete.age || !athlete.hrv_baseline_low) {
      setView('profile-setup');
    } else {
      await loadAthleteData(athleteId);
      setView('athlete-portal');
    }
  };

  const login = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const users = await api.fetch(`users?email=eq.${encodeURIComponent(email)}&select=*`);
      
      if (users && users.length > 0 && users[0].password_hash === password) {
        const user = users[0];
        
        if (user.athlete_id) {
          const athleteData = await api.fetch(`athletes?id=eq.${user.athlete_id}&select=*`);
          user.athlete = athleteData[0];
        }
        
        setCurrentUser(user);
        localStorage.setItem('speedandform_user', JSON.stringify(user));
        
        if (user.role === 'coach') {
          await loadAthletes();
          setView('coach-dashboard');
        } else {
          setSelectedAthlete(user.athlete);
          
          if (!user.athlete.age || !user.athlete.hrv_baseline_low) {
            setView('profile-setup');
          } else {
            await loadAthleteData(user.athlete_id);
            setView('athlete-portal');
          }
        }
      } else {
        setError('Invalid email or password');
      }
    } catch (error) {
      setError('Login failed: ' + error.message);
    }
    
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('speedandform_user');
    setCurrentUser(null);
    setView('login');
    setEmail('');
    setPassword('');
    setNavView('current');
  };

  const loadAthletes = async () => {
    const data = await api.fetch('athletes?select=*&order=name.asc');
    setAthletes(data || []);
  };

  const loadAthleteData = async (athleteId) => {
    const data = await api.fetch(`weekly_data?athlete_id=eq.${athleteId}&select=*&order=week_num.desc`);
    setWeeklyData(data || []);
    
    // Auto-create Week 1 if no data exists
    if (!data || data.length === 0) {
      await addWeek(athleteId);
    }
  };

  const selectAthlete = async (athlete) => {
    setSelectedAthlete(athlete);
    if (!athlete.age || !athlete.hrv_baseline_low) {
      setView('profile-setup');
    } else {
      await loadAthleteData(athlete.id);
      setView('athlete-portal');
      setNavView('current');
    }
  };

  const saveProfile = async (profileData) => {
    try {
      await api.fetch(`athletes?id=eq.${selectedAthlete.id}`, {
        method: 'PATCH',
        body: JSON.stringify(profileData)
      });
      
      setSelectedAthlete({ ...selectedAthlete, ...profileData });
      await loadAthleteData(selectedAthlete.id);
      setView('athlete-portal');
      setNavView('current');
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  const addWeek = async (athleteId = null) => {
    const targetAthleteId = athleteId || selectedAthlete.id;
    const lastWeek = weeklyData[0];
    const newWeek = {
      athlete_id: targetAthleteId,
      week_num: lastWeek ? lastWeek.week_num + 1 : 1,
      date: new Date().toISOString().split('T')[0],
      total_volume: 0
    };

    const inserted = await api.fetch('weekly_data', {
      method: 'POST',
      body: JSON.stringify(newWeek)
    });

    if (inserted && inserted[0]) {
      setWeeklyData([inserted[0], ...weeklyData]);
    }
  };

  const updateField = async (weekId, field, value) => {
    await api.fetch(`weekly_data?id=eq.${weekId}`, {
      method: 'PATCH',
      body: JSON.stringify({ [field]: value })
    });
    setWeeklyData(weeklyData.map(w => w.id === weekId ? { ...w, [field]: value } : w));
  };

  const deleteWeek = async (weekId) => {
    if (confirm('Are you sure you want to delete this week?')) {
      await api.fetch(`weekly_data?id=eq.${weekId}`, {
        method: 'DELETE'
      });
      setWeeklyData(weeklyData.filter(w => w.id !== weekId));
      setEditingWeek(null);
    }
  };

  const ProfileSetup = () => {
    const [profile, setProfile] = useState({
      age: selectedAthlete.age || '',
      starting_weight: selectedAthlete.starting_weight || '',
      baseline_vo2: selectedAthlete.baseline_vo2 || '',
      current_vo2: selectedAthlete.current_vo2 || '',
      target_vo2: selectedAthlete.target_vo2 || '',
      baseline_weekly_miles: selectedAthlete.baseline_weekly_miles || '',
      hrv_baseline_low: selectedAthlete.hrv_baseline_low || '',
      hrv_baseline_high: selectedAthlete.hrv_baseline_high || ''
    });

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 text-white p-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-light tracking-wide mb-2 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              ATHLETE PROFILE
            </h1>
            <p className="text-gray-400">Set up your baseline metrics</p>
          </div>

          <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Age</label>
                <input
                  type="number"
                  value={profile.age}
                  onChange={(e) => setProfile({...profile, age: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Starting Weight (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  value={profile.starting_weight}
                  onChange={(e) => setProfile({...profile, starting_weight: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Baseline VO2</label>
                <input
                  type="number"
                  value={profile.baseline_vo2}
                  onChange={(e) => setProfile({...profile, baseline_vo2: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Current VO2</label>
                <input
                  type="number"
                  value={profile.current_vo2}
                  onChange={(e) => setProfile({...profile, current_vo2: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Target VO2</label>
                <input
                  type="number"
                  value={profile.target_vo2}
                  onChange={(e) => setProfile({...profile, target_vo2: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Baseline Weekly Miles</label>
              <input
                type="number"
                step="0.1"
                value={profile.baseline_weekly_miles}
                onChange={(e) => setProfile({...profile, baseline_weekly_miles: e.target.value})}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">HRV Baseline Low</label>
                <input
                  type="number"
                  value={profile.hrv_baseline_low}
                  onChange={(e) => setProfile({...profile, hrv_baseline_low: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">HRV Baseline High</label>
                <input
                  type="number"
                  value={profile.hrv_baseline_high}
                  onChange={(e) => setProfile({...profile, hrv_baseline_high: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                />
              </div>
            </div>

            <button
              onClick={() => saveProfile(profile)}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium uppercase tracking-wider hover:shadow-lg hover:shadow-purple-500/50 transition-all"
            >
              Save Profile
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 text-white flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-light mb-2 tracking-wider bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              SPEED & FORM
            </h1>
            <p className="text-gray-500 text-sm uppercase tracking-widest">Athlete Tracking</p>
          </div>

          <form onSubmit={login} className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8">
            <div className="mb-6">
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/50 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:border-purple-500 outline-none transition-colors"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/50 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm focus:border-purple-500 outline-none transition-colors"
                required
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-900 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 uppercase tracking-wider"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'profile-setup') {
    return <ProfileSetup />;
  }

  if (view === 'coach-dashboard') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-800">
            <div>
              <h1 className="text-3xl font-light tracking-wide bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                COACH DASHBOARD
              </h1>
              <p className="text-gray-500 text-sm mt-1">Welcome back</p>
            </div>
            <button onClick={logout} className="text-gray-500 hover:text-white text-sm uppercase tracking-wider transition-colors">
              Logout
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {athletes.map(athlete => {
              const progress = athlete.baseline_vo2 && athlete.current_vo2 && athlete.target_vo2
                ? ((athlete.current_vo2 - athlete.baseline_vo2) / (athlete.target_vo2 - athlete.baseline_vo2) * 100).toFixed(1)
                : 0;

              return (
                <div key={athlete.id} className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600 transition-colors">
                  <h3 className="text-xl font-light tracking-wide mb-4">{athlete.name}</h3>
                  
                  {athlete.current_vo2 ? (
                    <>
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Current VO2</span>
                          <span className="text-white">{athlete.current_vo2}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Target VO2</span>
                          <span className="text-white">{athlete.target_vo2}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Progress</span>
                          <span className="text-purple-400">{progress}%</span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-800 h-2 rounded-full mb-4 overflow-hidden">
                        <div 
                          className="h-2 bg-gradient-to-r from-purple-500 to-pink-500 transition-all rounded-full"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-600 text-sm mb-4">No baseline data</div>
                  )}

                  <button
                    onClick={() => selectAthlete(athlete)}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all uppercase tracking-wider"
                  >
                    View Details
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Helper functions and navigation for athlete portal
  const isCoach = currentUser?.role === 'coach';
  const canEdit = isCoach || (currentUser?.athlete_id === selectedAthlete?.id);
  
  // FIXED: Use current week's VO2 for progress calculation
  const currentWeek = weeklyData[0];
  const progress = selectedAthlete?.baseline_vo2 && selectedAthlete?.target_vo2 && currentWeek?.vo2_max
    ? ((currentWeek.vo2_max - selectedAthlete.baseline_vo2) / (selectedAthlete.target_vo2 - selectedAthlete.baseline_vo2) * 100).toFixed(1)
    : 0;

  const getHrvStatus = (hrv, low, high) => {
    if (!hrv || !low || !high) return { text: '-', color: 'text-gray-400' };
    if (hrv < low || hrv > high) return { text: 'Unbalanced', color: 'text-pink-400' };
    return { text: 'Balanced', color: 'text-purple-400' };
  };

  const BottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 to-slate-950/95 backdrop-blur-xl border-t border-slate-800 z-[9999]">
      <div className="max-w-3xl mx-auto px-4 py-3 flex justify-around items-center">
        <button
          onClick={() => setNavView('current')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
            navView === 'current' ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Home size={22} />
          <span className="text-xs">Week</span>
        </button>
        <button
          onClick={() => setNavView('library')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
            navView === 'library' ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Calendar size={22} />
          <span className="text-xs">Library</span>
        </button>
        <button
          onClick={() => setNavView('profile')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
            navView === 'profile' ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <Settings size={22} />
          <span className="text-xs">Profile</span>
        </button>
        <button
          onClick={logout}
          className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-gray-500 hover:text-red-400 transition-colors"
        >
          <LogOut size={22} />
          <span className="text-xs">Logout</span>
        </button>
      </div>
    </div>
  );

  // Library View with Edit Capability
  if (navView === 'library') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 text-white p-4 pb-24">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-light">Week Library</h1>
            <button
              onClick={() => addWeek()}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all"
            >
              + New Week
            </button>
          </div>

          {weeklyData.length > 0 && (
            <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 mb-6">
              <h3 className="text-sm font-medium text-white uppercase tracking-wider mb-4">VO2 Progress</h3>
              <div className="relative h-32 flex items-end justify-around gap-2">
                {weeklyData.slice().reverse().map((week) => {
                  const height = week.vo2_max ? ((week.vo2_max - 40) / 30) * 100 : 0;
                  return (
                    <div key={week.id} className="flex-1 flex flex-col items-center max-w-16">
                      <div 
                        className="w-full bg-gradient-to-t from-purple-500 to-pink-500 rounded-t-lg transition-all"
                        style={{ height: `${Math.max(height, 5)}%` }}
                      />
                      <div className="text-xs text-gray-500 mt-2">W{week.week_num}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {weeklyData.map(week => (
              <div 
                key={week.id}
                className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedWeek(expandedWeek === week.id ? null : week.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border border-purple-500/30">
                      <span className="text-lg font-light">{week.week_num}</span>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium">Week {week.week_num}</div>
                      <div className="text-xs text-gray-500">{week.date || 'No date'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-purple-400">{week.vo2_max || '-'} VO2</div>
                      <div className="text-xs text-gray-500">{week.total_volume || '-'}mi</div>
                    </div>
                    <ChevronDown 
                      size={20} 
                      className={`text-gray-500 transition-transform ${
                        expandedWeek === week.id ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {expandedWeek === week.id && (
                  <div className="px-4 pb-4 border-t border-slate-800">
                    <div className="flex justify-end gap-2 mt-3 mb-2">
                      <button
                        onClick={() => setEditingWeek(week.id)}
                        className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-500/30 transition-colors flex items-center gap-1"
                      >
                        <Edit2 size={12} />
                        Edit
                      </button>
                      <button
                        onClick={() => deleteWeek(week.id)}
                        className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">VO2 Max</div>
                        {editingWeek === week.id ? (
                          <input
                            type="number"
                            value={week.vo2_max || ''}
                            onChange={(e) => updateField(week.id, 'vo2_max', e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white"
                          />
                        ) : (
                          <div className="text-lg font-light">{week.vo2_max || '-'}</div>
                        )}
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Total Volume</div>
                        {editingWeek === week.id ? (
                          <input
                            type="number"
                            step="0.1"
                            value={week.total_volume || ''}
                            onChange={(e) => updateField(week.id, 'total_volume', e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white"
                          />
                        ) : (
                          <div className="text-lg font-light">{week.total_volume || '-'} mi</div>
                        )}
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Resting HR</div>
                        {editingWeek === week.id ? (
                          <input
                            type="number"
                            value={week.resting_hr || ''}
                            onChange={(e) => updateField(week.id, 'resting_hr', e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white"
                          />
                        ) : (
                          <div className="text-lg font-light">{week.resting_hr || '-'}</div>
                        )}
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">HRV</div>
                        {editingWeek === week.id ? (
                          <input
                            type="number"
                            value={week.hrv || ''}
                            onChange={(e) => updateField(week.id, 'hrv', e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white"
                          />
                        ) : (
                          <div className="text-lg font-light">{week.hrv || '-'}</div>
                        )}
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Weight</div>
                        {editingWeek === week.id ? (
                          <input
                            type="number"
                            step="0.1"
                            value={week.weight || ''}
                            onChange={(e) => updateField(week.id, 'weight', e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white"
                          />
                        ) : (
                          <div className="text-lg font-light">{week.weight || '-'}</div>
                        )}
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Sleep</div>
                        {editingWeek === week.id ? (
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={week.sleep_quality || ''}
                            onChange={(e) => updateField(week.id, 'sleep_quality', e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white"
                          />
                        ) : (
                          <div className="text-lg font-light">{week.sleep_quality || '-'}/10</div>
                        )}
                      </div>
                    </div>
                    
                    {editingWeek === week.id && (
                      <button
                        onClick={() => setEditingWeek(null)}
                        className="w-full mt-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all"
                      >
                        Done Editing
                      </button>
                    )}

                    {week.weekly_observations && (
                      <div className="mt-3">
                        <div className="text-xs text-gray-500 mb-2">OBSERVATIONS</div>
                        <div className="text-sm text-gray-300 bg-white/5 rounded-lg p-3">
                          {week.weekly_observations}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Profile View
  if (navView === 'profile') {
    const [editProfile, setEditProfile] = useState({
      age: selectedAthlete?.age || '',
      starting_weight: selectedAthlete?.starting_weight || '',
      baseline_vo2: selectedAthlete?.baseline_vo2 || '',
      target_vo2: selectedAthlete?.target_vo2 || '',
      baseline_weekly_miles: selectedAthlete?.baseline_weekly_miles || '',
      hrv_baseline_low: selectedAthlete?.hrv_baseline_low || '',
      hrv_baseline_high: selectedAthlete?.hrv_baseline_high || ''
    });

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 text-white p-4 pb-24">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-light mb-6">Edit Profile</h1>

          <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Age</label>
                <input
                  type="number"
                  value={editProfile.age}
                  onChange={(e) => setEditProfile({...editProfile, age: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Weight (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  value={editProfile.starting_weight}
                  onChange={(e) => setEditProfile({...editProfile, starting_weight: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">VO2 Max Journey</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-600 mb-1">Baseline</div>
                  <input
                    type="number"
                    value={editProfile.baseline_vo2}
                    onChange={(e) => setEditProfile({...editProfile, baseline_vo2: e.target.value})}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">Target</div>
                  <input
                    type="number"
                    value={editProfile.target_vo2}
                    onChange={(e) => setEditProfile({...editProfile, target_vo2: e.target.value})}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">HRV Balanced Range</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-600 mb-1">Low</div>
                  <input
                    type="number"
                    value={editProfile.hrv_baseline_low}
                    onChange={(e) => setEditProfile({...editProfile, hrv_baseline_low: e.target.value})}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-600 mb-1">High</div>
                  <input
                    type="number"
                    value={editProfile.hrv_baseline_high}
                    onChange={(e) => setEditProfile({...editProfile, hrv_baseline_high: e.target.value})}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Baseline Weekly Miles</label>
              <input
                type="number"
                step="0.1"
                value={editProfile.baseline_weekly_miles}
                onChange={(e) => setEditProfile({...editProfile, baseline_weekly_miles: e.target.value})}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white"
              />
            </div>

            <button
              onClick={() => saveProfile(editProfile)}
              className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium uppercase tracking-wider hover:shadow-lg hover:shadow-purple-500/50 transition-all flex items-center justify-center gap-2"
            >
              <Check size={18} />
              Save Changes
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Main current week view
  const lastWeek = weeklyData[1];
  const hrvStatus = getHrvStatus(
    currentWeek?.hrv,
    selectedAthlete?.hrv_baseline_low,
    selectedAthlete?.hrv_baseline_high
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 text-white p-4 pb-32">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-light">WEEK {currentWeek?.week_num || 1}</h1>
          <p className="text-gray-500 text-sm">{currentWeek?.date || new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
        </div>

        {/* VO2 Progress Card */}
        <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">VO2 MAX PROGRESS</h3>
              <div className="text-5xl font-light">{currentWeek?.vo2_max || selectedAthlete?.baseline_vo2 || '-'}</div>
            </div>
            <div className="relative w-20 h-20">
              <svg className="transform -rotate-90 w-20 h-20">
                <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-700" />
                <circle 
                  cx="40" cy="40" r="32" 
                  stroke="url(#gradient)" 
                  strokeWidth="6" 
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - progress / 100)}`}
                  className="transition-all duration-500"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-medium">{progress}%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">This Week</div>
              <input
                type="number"
                step="0.1"
                value={currentWeek?.total_volume || 0}
                onChange={(e) => canEdit && updateField(currentWeek?.id, 'total_volume', e.target.value)}
                disabled={!canEdit}
                className="w-full bg-transparent text-2xl font-light text-white border-none outline-none"
                placeholder="0"
              />
              <div className="text-xs text-gray-500">miles</div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Last Week</div>
              <div className="text-2xl font-light">{lastWeek?.total_volume || 0}</div>
              <div className="text-xs text-gray-500">miles</div>
            </div>
          </div>
        </div>

        {/* Sunday Check-in */}
        <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-medium uppercase tracking-wider">SUNDAY CHECK-IN</h3>
            <ChevronDown size={20} className="text-gray-500" />
          </div>

          {/* VO2 Max Slider */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <TrendingUp size={16} />
                <span>VO2 MAX</span>
              </div>
              <span className="text-2xl font-light">{currentWeek?.vo2_max || '-'}</span>
            </div>
            <input
              type="range"
              min="40"
              max="70"
              value={currentWeek?.vo2_max || 50}
              onChange={(e) => canEdit && updateField(currentWeek?.id, 'vo2_max', e.target.value)}
              disabled={!canEdit}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-purple"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>40</span>
              <span className="text-gray-500">Last week: {lastWeek?.vo2_max || '-'}</span>
              <span>70</span>
            </div>
          </div>

          {/* Resting HR Slider */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Heart size={16} />
                <span>RESTING HR</span>
              </div>
              <span className="text-2xl font-light">{currentWeek?.resting_hr || '-'}</span>
            </div>
            <input
              type="range"
              min="40"
              max="80"
              value={currentWeek?.resting_hr || 60}
              onChange={(e) => canEdit && updateField(currentWeek?.id, 'resting_hr', e.target.value)}
              disabled={!canEdit}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-purple"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>40</span>
              <span className="text-gray-500">Last: {lastWeek?.resting_hr || '-'}</span>
              <span>80</span>
            </div>
          </div>

          {/* HRV Slider */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Activity size={16} />
                <span>HRV</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-light">{currentWeek?.hrv || '-'}</div>
                <div className={`text-xs ${hrvStatus.color}`}>{hrvStatus.text}</div>
              </div>
            </div>
            <input
              type="range"
              min="30"
              max="100"
              value={currentWeek?.hrv || 65}
              onChange={(e) => canEdit && updateField(currentWeek?.id, 'hrv', e.target.value)}
              disabled={!canEdit}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-purple"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>30</span>
              <span className="text-purple-400">Range: {selectedAthlete?.hrv_baseline_low || '-'}-{selectedAthlete?.hrv_baseline_high || '-'}</span>
              <span>100</span>
            </div>
          </div>

          {/* Weight Slider */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <TrendingUp size={16} />
                <span>WEIGHT (LBS)</span>
              </div>
              <span className="text-2xl font-light">{currentWeek?.weight || '-'}</span>
            </div>
            <input
              type="range"
              min="120"
              max="220"
              value={currentWeek?.weight || selectedAthlete?.starting_weight || 165}
              onChange={(e) => canEdit && updateField(currentWeek?.id, 'weight', e.target.value)}
              disabled={!canEdit}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-purple"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>120</span>
              <span className="text-gray-500">Last: {lastWeek?.weight || '-'}</span>
              <span>220</span>
            </div>
          </div>

          {/* Sleep Quality Slider */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Activity size={16} />
                <span>SLEEP QUALITY</span>
              </div>
              <span className="text-2xl font-light">{currentWeek?.sleep_quality || '-'}/10</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={currentWeek?.sleep_quality || 7}
              onChange={(e) => canEdit && updateField(currentWeek?.id, 'sleep_quality', e.target.value)}
              disabled={!canEdit}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-purple"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>Poor</span>
              <span className="text-gray-500">Last: {lastWeek?.sleep_quality || '-'}</span>
              <span>Great</span>
            </div>
          </div>
        </div>

        {/* Key Sessions */}
        <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium uppercase tracking-wider">KEY SESSIONS</h3>
            <button className="text-purple-400 text-sm">Edit</button>
          </div>

          <div className="space-y-4">
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Threshold</div>
              <div className="text-sm">6.2mi • 7:15/mi • 165 HR</div>
            </div>

            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Long Run</div>
              <div className="text-sm">90min • 12mi • 7:30/mi • 152 HR</div>
            </div>

            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Speed/VO2</div>
              <div className="text-sm">6x800m • 5:45/mi • 178 HR • Rec: 145</div>
            </div>
          </div>
        </div>

        {/* Save Week Button */}
        <button
          onClick={() => addWeek()}
          className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-medium uppercase tracking-wider hover:shadow-lg hover:shadow-purple-500/50 transition-all mb-6"
        >
          + NEW WEEK
        </button>
      </div>

      <BottomNav />

      <style jsx>{`
        .slider-purple::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          cursor: pointer;
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
        }

        .slider-purple::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          cursor: pointer;
          border: none;
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
        }
      `}</style>
    </div>
  );
}
