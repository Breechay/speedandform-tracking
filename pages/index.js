import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Eye, EyeOff, Upload, X, TrendingUp, Activity, Heart } from 'lucide-react';

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
  const [currentUser, setCurrentUser] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

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

  const loadAthletes = async () => {
    const data = await api.fetch('athletes?select=*&order=name.asc');
    setAthletes(data || []);
  };

  const loadAthleteData = async (athleteId) => {
    const data = await api.fetch(`weekly_data?athlete_id=eq.${athleteId}&select=*&order=week_num.desc`);
    setWeeklyData(data || []);
  };

  const selectAthlete = async (athlete) => {
    setSelectedAthlete(athlete);
    if (!athlete.age || !athlete.hrv_baseline_low) {
      setView('profile-setup');
    } else {
      await loadAthleteData(athlete.id);
      setView('athlete-detail');
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
      setView(currentUser.role === 'coach' ? 'athlete-detail' : 'athlete-portal');
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  const addWeek = async () => {
    const lastWeek = weeklyData[0];
    const newWeek = {
      athlete_id: selectedAthlete.id,
      week_num: lastWeek ? lastWeek.week_num + 1 : 1,
      date: new Date().toISOString().split('T')[0]
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

  const togglePublic = async (athleteId, isPublic) => {
    await api.fetch(`athletes?id=eq.${athleteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ 
        is_public: !isPublic,
        published_at: !isPublic ? new Date().toISOString() : null
      })
    });
    
    if (view === 'coach-dashboard') {
      await loadAthletes();
    } else {
      setSelectedAthlete({...selectedAthlete, is_public: !isPublic});
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setView('login');
    setEmail('');
    setPassword('');
  };

  // Profile Setup Component
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
// LOGIN VIEW
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

  // PROFILE SETUP VIEW
  if (view === 'profile-setup') {
    return <ProfileSetup />;
  }

  // COACH DASHBOARD
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
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-light tracking-wide">{athlete.name}</h3>
                    <button
                      onClick={() => togglePublic(athlete.id, athlete.is_public)}
                      className="text-gray-500 hover:text-white transition-colors"
                      title={athlete.is_public ? 'Public' : 'Private'}
                    >
                      {athlete.is_public ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                  
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
// MAIN TRACKING VIEW
  const isCoach = currentUser?.role === 'coach';
  const canEdit = isCoach || (currentUser?.athlete_id === selectedAthlete?.id);
  const progress = selectedAthlete?.baseline_vo2 && selectedAthlete?.current_vo2 && selectedAthlete?.target_vo2
    ? ((selectedAthlete.current_vo2 - selectedAthlete.baseline_vo2) / (selectedAthlete.target_vo2 - selectedAthlete.baseline_vo2) * 100).toFixed(1)
    : 0;

  const getHrvStatus = (hrv, low, high) => {
    if (!hrv || !low || !high) return { text: '-', color: 'text-gray-400' };
    if (hrv < low || hrv > high) return { text: 'Unbalanced', color: 'text-pink-400' };
    return { text: 'Balanced', color: 'text-purple-400' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 pb-6 border-b border-slate-800">
          <div className="flex justify-between items-start mb-4">
            {isCoach && (
              <button
                onClick={() => setView('coach-dashboard')}
                className="flex items-center gap-2 text-gray-500 hover:text-white text-sm uppercase tracking-wider transition-colors"
              >
                <ArrowLeft size={18} /> Dashboard
              </button>
            )}
            <button onClick={logout} className="ml-auto text-gray-500 hover:text-white text-sm uppercase tracking-wider transition-colors">
              Logout
            </button>
          </div>

          <h1 className="text-3xl font-light tracking-wide mb-2 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            {selectedAthlete?.name}
          </h1>
        </div>

        {/* Weekly Data */}
        {weeklyData.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No training data yet</p>
            {canEdit && (
              <button
                onClick={addWeek}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all uppercase tracking-wider"
              >
                Add First Week
              </button>
            )}
          </div>
        ) : (
          <>
            {weeklyData.map(week => {
              const hrvStatus = getHrvStatus(week.hrv, selectedAthlete.hrv_baseline_low, selectedAthlete.hrv_baseline_high);
              
              return (
                <div key={week.id} className="mb-8 bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
                  {/* Week Header */}
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-light tracking-wide">Week {week.week_num}</h2>
                    <input
                      type="date"
                      value={week.date || ''}
                      onChange={(e) => canEdit && updateField(week.id, 'date', e.target.value)}
                      disabled={!canEdit}
                      className="bg-black/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50"
                    />
                  </div>

                  {/* VO2 Progress Ring */}
                  <div className="mb-6 p-6 bg-white/5 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">VO2 Max Progress</div>
                        <div className="text-3xl font-light">{week.vo2_max || selectedAthlete.current_vo2}</div>
                      </div>
                      <div className="relative w-20 h-20">
                        <svg className="transform -rotate-90 w-20 h-20">
                          <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="none" className="text-white/10" />
                          <circle cx="40" cy="40" r="36" stroke="url(#gradient)" strokeWidth="6" fill="none" 
                            strokeDasharray="226" 
                            strokeDashoffset={226 - (226 * progress / 100)} 
                            className="transition-all duration-500" 
                            strokeLinecap="round" />
                          <defs>
                            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" className="text-purple-500" stopColor="currentColor" />
                              <stop offset="100%" className="text-pink-500" stopColor="currentColor" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-white/60">{progress}%</div>
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs mt-4">
                      <div className="flex-1 bg-white/5 rounded-lg p-3">
                        <div className="text-white/40 mb-1">This Week</div>
                        <input
                          type="number"
                          step="0.1"
                          value={week.total_volume || ''}
                          onChange={(e) => canEdit && updateField(week.id, 'total_volume', e.target.value)}
                          disabled={!canEdit}
                          placeholder="0"
                          className="w-full bg-transparent text-white font-medium text-xl text-center outline-none disabled:opacity-50"
                        />
                        <div className="text-white/40 mt-1 text-center">miles</div>
                      </div>
                      <div className="flex-1 bg-white/5 rounded-lg p-3">
                        <div className="text-white/40 mb-1">Baseline</div>
                        <div className="text-white font-medium text-xl text-center">{selectedAthlete.baseline_weekly_miles || '-'}</div>
                        <div className="text-white/40 mt-1 text-center">miles</div>
                      </div>
                    </div>
                  </div>

                  {/* Sunday Check-in */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-white uppercase tracking-wider mb-4">Sunday Check-in</h3>
                    <div className="space-y-6">
                      {/* VO2 Max Slider */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp size={14} className="text-purple-300" />
                            VO2 Max
                          </label>
                          <span className="text-lg font-light">{week.vo2_max || '-'}</span>
                        </div>
                        <input
                          type="range"
                          min="40"
                          max="70"
                          value={week.vo2_max || 50}
                          onChange={(e) => canEdit && updateField(week.id, 'vo2_max', e.target.value)}
                          disabled={!canEdit}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-purple-500 disabled:opacity-50"
                          style={{
                            background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${((week.vo2_max - 40) / 30) * 100}%, rgba(255,255,255,0.1) ${((week.vo2_max - 40) / 30) * 100}%, rgba(255,255,255,0.1) 100%)`
                          }}
                        />
                        <div className="flex justify-between text-xs text-white/30 mt-1">
                          <span>40</span>
                          <span>70</span>
                        </div>
                      </div>

                      {/* Resting HR Slider */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-2">
                            <Heart size={14} className="text-purple-300" />
                            Resting HR
                          </label>
                          <span className="text-lg font-light">{week.resting_hr || '-'}</span>
                        </div>
                        <input
                          type="range"
                          min="40"
                          max="80"
                          value={week.resting_hr || 60}
                          onChange={(e) => canEdit && updateField(week.id, 'resting_hr', e.target.value)}
                          disabled={!canEdit}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-purple-500 disabled:opacity-50"
                          style={{
                            background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${((week.resting_hr - 40) / 40) * 100}%, rgba(255,255,255,0.1) ${((week.resting_hr - 40) / 40) * 100}%, rgba(255,255,255,0.1) 100%)`
                          }}
                        />
                        <div className="flex justify-between text-xs text-white/30 mt-1">
                          <span>40</span>
                          <span>80</span>
                        </div>
                      </div>

                      {/* HRV with Range */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-2">
                            <Activity size={14} className="text-purple-300" />
                            HRV
                          </label>
                          <div className="text-right">
                            <div className="text-lg font-light">{week.hrv || '-'}</div>
                            <div className={`text-xs font-medium ${hrvStatus.color}`}>{hrvStatus.text}</div>
                          </div>
                        </div>
                        
                        <div className="relative h-12 mb-2">
                          <div className="absolute top-5 left-0 right-0 h-2 bg-white/5 rounded-full" />
                          
                          {selectedAthlete.hrv_baseline_low && selectedAthlete.hrv_baseline_high && (
                            <>
                              <div 
                                className="absolute top-5 h-2 rounded-full bg-gradient-to-r from-purple-500/40 via-purple-400/40 to-pink-500/40"
                                style={{
                                  left: `${((selectedAthlete.hrv_baseline_low - 30) / 70) * 100}%`,
                                  width: `${((selectedAthlete.hrv_baseline_high - selectedAthlete.hrv_baseline_low) / 70) * 100}%`
                                }}
                              />
                              <div 
                                className="absolute top-3 w-px h-6 bg-purple-400/60"
                                style={{ left: `${((selectedAthlete.hrv_baseline_low - 30) / 70) * 100}%` }}
                              />
                              <div 
                                className="absolute top-3 w-px h-6 bg-purple-400/60"
                                style={{ left: `${((selectedAthlete.hrv_baseline_high - 30) / 70) * 100}%` }}
                              />
                            </>
                          )}
                          
                          {week.hrv && (
                            <div 
                              className="absolute top-3 transition-all duration-200"
                              style={{ left: `calc(${((week.hrv - 30) / 70) * 100}% - 12px)` }}
                            >
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 shadow-lg shadow-purple-500/50 flex items-center justify-center">
                                <div className="w-2 h-2 rounded-full bg-white" />
                              </div>
                            </div>
                          )}
                          
                          <input
                            type="range"
                            min="30"
                            max="100"
                            value={week.hrv || 50}
                            onChange={(e) => canEdit && updateField(week.id, 'hrv', e.target.value)}
                            disabled={!canEdit}
                            className="absolute top-0 left-0 w-full h-12 opacity-0 cursor-pointer z-10 disabled:cursor-default"
                          />
                        </div>
                        
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-white/30">30</span>
                          {selectedAthlete.hrv_baseline_low && (
                            <span className="text-purple-400/80">
                              Range: {selectedAthlete.hrv_baseline_low}-{selectedAthlete.hrv_baseline_high}
                            </span>
                          )}
                          <span className="text-white/30">100</span>
                        </div>
                      </div>

                      {/* Weight Slider */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-white/60 uppercase tracking-wider">Weight (lbs)</label>
                          <span className="text-lg font-light">{week.weight || '-'}</span>
                        </div>
                        <input
                          type="range"
                          min="120"
                          max="220"
                          value={week.weight || 165}
                          onChange={(e) => canEdit && updateField(week.id, 'weight', e.target.value)}
                          disabled={!canEdit}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-purple-500 disabled:opacity-50"
                          style={{
                            background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${((week.weight - 120) / 100) * 100}%, rgba(255,255,255,0.1) ${((week.weight - 120) / 100) * 100}%, rgba(255,255,255,0.1) 100%)`
                          }}
                        />
                        <div className="flex justify-between text-xs text-white/30 mt-1">
                          <span>120</span>
                          <span>220</span>
                        </div>
                      </div>

                      {/* Sleep Quality Slider */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-white/60 uppercase tracking-wider">Sleep Quality</label>
                          <span className="text-lg font-light">{week.sleep_quality || '-'}/10</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={week.sleep_quality || 5}
                          onChange={(e) => canEdit && updateField(week.id, 'sleep_quality', e.target.value)}
                          disabled={!canEdit}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-purple-500 disabled:opacity-50"
                          style={{
                            background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${((week.sleep_quality - 1) / 9) * 100}%, rgba(255,255,255,0.1) ${((week.sleep_quality - 1) / 9) * 100}%, rgba(255,255,255,0.1) 100%)`
                          }}
                        />
                        <div className="flex justify-between text-xs text-white/30 mt-1">
                          <span>Poor</span>
                          <span>Great</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Key Sessions */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-white uppercase tracking-wider mb-4">Key Sessions</h3>
                    <div className="space-y-3">
                      {/* Threshold */}
                      <div className="bg-white/5 rounded-lg p-4">
                        <div className="text-xs text-white/60 mb-3">THRESHOLD</div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Miles"
                            value={week.threshold_miles || ''}
                            onChange={(e) => canEdit && updateField(week.id, 'threshold_miles', e.target.value)}
                            disabled={!canEdit}
                            className="bg-black/50 border border-white/10 rounded px-2 py-2 text-sm text-white placeholder-white/30 disabled:opacity-50"
                          />
                          <input
                            type="text"
                            placeholder="Pace"
                            value={week.threshold_pace || ''}
                            onChange={(e) => canEdit && updateField(week.id, 'threshold_pace', e.target.value)}
                            disabled={!canEdit}
                            className="bg-black/50 border border-white/10 rounded px-2 py-2 text-sm text-white placeholder-white/30 disabled:opacity-50"
                          />
                          <input
                            type="number"
                            placeholder="HR"
                            value={week.threshold_avg_hr || ''}
                            onChange={(e) => canEdit && updateField(week.id, 'threshold_avg_hr', e.target.value)}
                            disabled={!canEdit}
                            className="bg-black/50 border border-white/10 rounded px-2 py-2 text-sm text-white placeholder-white/30 disabled:opacity-50"
                          />
                        </div>
                      </div>

                      {/* Speed/VO2 */}
                      <div className="bg-white/5 rounded-lg p-4">
                        <div className="text-xs text-white/60 mb-3">SPEED/VO2</div>
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Workout (e.g., 6x800m)"
                            value={week.speed_workout || ''}
                            onChange={(e) => canEdit && updateField(week.id, 'speed_workout', e.target.value)}
                            disabled={!canEdit}
                            className="w-full bg-black/50 border border-white/10 rounded px-2 py-2 text-sm text-white placeholder-white/30 disabled:opacity-50"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="Pace"
                              value={week.speed_pace || ''}
                              onChange={(e) => canEdit && updateField(week.id, 'speed_pace', e.target.value)}
                              disabled={!canEdit}
                              className="bg-black/50 border border-white/10 rounded px-2 py-2 text-sm text-white placeholder-white/30 disabled:opacity-50"
                            />
                            <input
                              type="number"
                              placeholder="Avg HR"
                              value={week.speed_avg_hr || ''}
                              onChange={(e) => canEdit && updateField(week.id, 'speed_avg_hr', e.target.value)}
                              disabled={!canEdit}
                              className="bg-black/50 border border-white/10 rounded px-2 py-2 text-sm text-white placeholder-white/30 disabled:opacity-50"
                            />
                            <input
                              type="number"
                              placeholder="Rec HR"
                              value={week.speed_recovery_hr || ''}
                              onChange={(e) => canEdit && updateField(week.id, 'speed_recovery_hr', e.target.value)}
                              disabled={!canEdit}
                              className="bg-black/50 border border-white/10 rounded px-2 py-2 text-sm text-white placeholder-white/30 disabled:opacity-50"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Long Run */}
                      <div className="bg-white/5 rounded-lg p-4">
                        <div className="text-xs text-white/60 mb-3">LONG RUN</div>
                        <div className="grid grid-cols-4 gap-2">
                          <input
                            type="text"
                            placeholder="Duration"
                            value={week.long_run_duration || ''}
                            onChange={(e) => canEdit && updateField(week.id, 'long_run_duration', e.target.value)}
                            disabled={!canEdit}
                            className="bg-black/50 border border-white/10 rounded px-2 py-2 text-sm text-white placeholder-white/30 disabled:opacity-50"
                          />
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Miles"
                            value={week.long_run_miles || ''}
                            onChange={(e) => canEdit && updateField(week.id, 'long_run_miles', e.target.value)}
                            disabled={!canEdit}
                            className="bg-black/50 border border-white/10 rounded px-2 py-2 text-sm text-white placeholder-white/30 disabled:opacity-50"
                          />
                          <input
                            type="text"
                            placeholder="Pace"
                            value={week.long_run_pace || ''}
                            onChange={(e) => canEdit && updateField(week.id, 'long_run_pace', e.target.value)}
                            disabled={!canEdit}
                            className="bg-black/50 border border-white/10 rounded px-2 py-2 text-sm text-white placeholder-white/30 disabled:opacity-50"
                          />
                          <input
                            type="number"
                            placeholder="HR"
                            value={week.long_run_avg_hr || ''}
                            onChange={(e) => canEdit && updateField(week.id, 'long_run_avg_hr', e.target.value)}
                            disabled={!canEdit}
                            className="bg-black/50 border border-white/10 rounded px-2 py-2 text-sm text-white placeholder-white/30 disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Observations */}
                  <div className="mb-4">
                    <label className="block text-sm text-white/60 uppercase tracking-wider mb-2">Weekly Observations</label>
                    <textarea
                      value={week.weekly_observations || ''}
                      onChange={(e) => canEdit && updateField(week.id, 'weekly_observations', e.target.value)}
                      disabled={!canEdit}
                      placeholder="What were the breakthrough moments this week? Any insights on pacing, recovery, or mental state? Note anything that felt different - good or challenging..."
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-sm h-24 disabled:opacity-50 placeholder-white/30"
                    />
                  </div>

                  {/* Coach Notes */}
                  {isCoach && (
                    <div>
                      <label className="block text-sm text-purple-400/80 uppercase tracking-wider mb-2">Coach Notes (Private)</label>
                      <textarea
                        value={week.coach_notes || ''}
                        onChange={(e) => updateField(week.id, 'coach_notes', e.target.value)}
                        placeholder="Your private notes..."
                        className="w-full bg-black/50 border border-purple-900/30 rounded-lg px-4 py-3 text-sm h-24 placeholder-white/30"
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Actions */}
            <div className="flex gap-4 flex-wrap">
              {canEdit && (
                <button
                  onClick={addWeek}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all uppercase tracking-wider"
                >
                  Add Week
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
