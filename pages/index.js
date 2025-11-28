import React, { useState, useEffect } from 'react';
import { TrendingUp, Activity, Heart, Settings, Calendar, Home, LogOut, ChevronDown, X, Check, Upload } from 'lucide-react';

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
      setView('athlete-portal');
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
      setNavView('current');
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

  const BottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 to-slate-950/95 backdrop-blur-xl border-t border-slate-800 pb-safe">
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

  if (navView === 'library') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 text-white p-4 pb-24">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-light mb-6">Week Library</h1>

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
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Resting HR</div>
                        <div className="text-lg font-light">{week.resting_hr || '-'}</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">HRV</div>
                        <div className="text-lg font-light">{week.hrv || '-'}</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Weight</div>
                        <div className="text-lg font-light">{week.weight || '-'}</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3">
                        <div className="text-xs text-gray-500 mb-1">Sleep</div>
                        <div className="text-lg font-light">{week.sleep_quality || '-'}/10</div>
                      </div>
                    </div>
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

  if (navView === 'profile') {
    const [editProfile, setEditProfile] = useState({
      age: selectedAthlete?.age || '',
      starting_weight: selectedAthlete?.starting_weight || '',
      baseline_vo2: selectedAthlete?.baseline_vo2 || '',
      current_vo2: selectedAthlete?.current_vo2 || '',
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
              <div className="grid grid-cols-3 gap-3">
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
                  <div className="text-xs text-gray-600 mb-1">Current</div>
                  <input
                    type="number"
                    value={editProfile.current_vo2}
                    onChange={(e) => setEditProfile({...editProfile, current_vo2: e.target.value})}
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

  const currentWeek = weeklyData[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 text-white p-4 pb-24">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-light">{selectedAthlete?.name}</h1>
        </div>

        {!currentWeek ? (
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
          <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-light">Week {currentWeek.week_num}</h2>
              <input
                type="date"
                value={currentWeek.date || ''}
                onChange={(e) => canEdit && updateField(currentWeek.id, 'date', e.target.value)}
                disabled={!canEdit}
                className="bg-black/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50"
              />
            </div>

            {/* VO2 Progress & Volume */}
            <div className="mb-6 p-4 bg-white/5 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">VO2 Max</div>
                  <div className="text-2xl font-light">{currentWeek.vo2_max || selectedAthlete.current_vo2 || '-'}</div>
                </div>
                <div className="relative w-16 h-16">
                  <svg className="transform -rotate-90 w-16 h-16">
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="4" fill="none" className="text-white/10" />
                    <circle cx="32" cy="32" r="28" stroke="url(#grad)" strokeWidth="4" fill="none" 
                      strokeDasharray="176" 
                      strokeDashoffset={176 - (176 * progress / 100)} 
                      className="transition-all" 
                      strokeLinecap="round" />
                    <defs>
                      <linearGradient id="grad">
                        <stop offset="0%" stopColor="#a855f7" />
                        <stop offset="100%" stopColor="#ec4899" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-white/60">{progress}%</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">This Week</div>
                  <input
                    type="number"
                    step="0.1"
                    value={currentWeek.total_volume || ''}
                    onChange={(e) => canEdit && updateField(currentWeek.id, 'total_volume', e.target.value)}
                    disabled={!canEdit}
                    placeholder="0"
                    className="w-full bg-transparent text-white font-medium text-lg text-center outline-none disabled:opacity-50"
                  />
                  <div className="text-xs text-gray-400 text-center">miles</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-xs text-gray-400 mb-1">Baseline</div>
                  <div className="text-lg font-medium text-center">{selectedAthlete.baseline_weekly_miles || '-'}</div>
                  <div className="text-xs text-gray-400 text-center">miles</div>
                </div>
              </div>
            </div>

            {/* Sunday Check-in - just showing first few sliders for brevity */}
            <div className="mb-6">
              <h3 className="text-sm font-medium uppercase tracking-wider mb-4">Sunday Check-in</h3>
              <div className="space-y-6">
                {/* VO2 Slider */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-2">
                      <TrendingUp size={14} className="text-purple-300" />
                      VO2 Max
                    </label>
                    <span className="text-lg font-light">{currentWeek.vo2_max || '-'}</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="70"
                    value={currentWeek.vo2_max || 50}
                    onChange={(e) => canEdit && updateField(currentWeek.id, 'vo2_max', e.target.value)}
                    disabled={!canEdit}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-purple-500 disabled:opacity-50"
                    style={{
                      background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${((currentWeek.vo2_max || 50) - 40) / 30 * 100}%, rgba(255,255,255,0.1) ${((currentWeek.vo2_max || 50) - 40) / 30 * 100}%, rgba(255,255,255,0.1) 100%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>40</span>
                    <span>70</span>
                  </div>
                </div>

                {/* Add similar sliders for HR, HRV, Weight, Sleep... (code from previous part 3) */}
              </div>
            </div>

            {/* Add Week button */}
            {canEdit && (
              <button
                onClick={addWeek}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium uppercase tracking-wider hover:shadow-lg hover:shadow-purple-500/50 transition-all"
              >
                Add New Week
              </button>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
