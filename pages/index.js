import React, { useState, useEffect } from 'react';
import { TrendingUp, Activity, Heart, Settings, Calendar, Home, LogOut, ChevronDown, Check, Edit2, MoreVertical } from 'lucide-react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY;

console.log('Supabase URL:', SUPABASE_URL);
console.log('Supabase Key exists:', !!SUPABASE_KEY);

const api = {
  async fetch(endpoint, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    console.log('API Call:', url, options.method || 'GET');
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...options.headers
      }
    });
    
    const data = await response.json();
    console.log('API Response:', data);
    return data;
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
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  // Check for saved login on mount
  useEffect(() => {
    console.log('Checking for saved user...');
    const savedUser = localStorage.getItem('speedandform_user');
    console.log('Saved user:', savedUser);
    
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        console.log('Parsed user:', user);
        setCurrentUser(user);
        
        if (user.role === 'coach') {
          loadAthletes();
          setView('coach-dashboard');
        } else if (user.athlete_id) {
          loadAthleteProfile(user.athlete_id);
        }
      } catch (e) {
        console.error('Error parsing saved user:', e);
        localStorage.removeItem('speedandform_user');
      }
    }
  }, []);

  const loadAthleteProfile = async (athleteId) => {
    console.log('Loading athlete profile:', athleteId);
    try {
      const athleteData = await api.fetch(`athletes?id=eq.${athleteId}&select=*`);
      console.log('Athlete data:', athleteData);
      
      if (!athleteData || athleteData.length === 0) {
        setError('Athlete not found');
        return;
      }
      
      const athlete = athleteData[0];
      setSelectedAthlete(athlete);
      
      // Check if profile is complete
      if (!athlete.baseline_vo2 || !athlete.target_vo2) {
        console.log('Profile incomplete, showing setup');
        setView('profile-setup');
      } else {
        await loadAthleteData(athleteId);
        setView('athlete-portal');
      }
    } catch (error) {
      console.error('Error loading athlete:', error);
      setError('Failed to load athlete data');
    }
  };

  const login = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    console.log('Attempting login:', email);
    
    try {
      const users = await api.fetch(`users?email=eq.${encodeURIComponent(email)}&select=*`);
      console.log('Users found:', users);
      
      if (users && users.length > 0 && users[0].password_hash === password) {
        const user = users[0];
        console.log('Login successful:', user);
        
        if (user.athlete_id) {
          const athleteData = await api.fetch(`athletes?id=eq.${user.athlete_id}&select=*`);
          user.athlete = athleteData[0];
          console.log('Athlete loaded:', athleteData[0]);
        }
        
        setCurrentUser(user);
        localStorage.setItem('speedandform_user', JSON.stringify(user));
        console.log('User saved to localStorage');
        
        if (user.role === 'coach') {
          await loadAthletes();
          setView('coach-dashboard');
        } else {
          setSelectedAthlete(user.athlete);
          
          if (!user.athlete || !user.athlete.baseline_vo2 || !user.athlete.target_vo2) {
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
      console.error('Login error:', error);
      setError('Login failed: ' + error.message);
    }
    
    setLoading(false);
  };

  const logout = () => {
    console.log('Logging out');
    localStorage.removeItem('speedandform_user');
    setCurrentUser(null);
    setSelectedAthlete(null);
    setWeeklyData([]);
    setView('login');
    setNavView('current');
    setEmail('');
    setPassword('');
  };

  const loadAthletes = async () => {
    console.log('Loading athletes...');
    const data = await api.fetch('athletes?select=*&order=name.asc');
    setAthletes(data || []);
  };

  const loadAthleteData = async (athleteId) => {
    console.log('Loading weekly data for athlete:', athleteId);
    const data = await api.fetch(`weekly_data?athlete_id=eq.${athleteId}&select=*&order=week_num.desc`);
    console.log('Weekly data:', data);
    setWeeklyData(data || []);
    
    // Auto-create Week 1 if no data exists
    if (!data || data.length === 0) {
      console.log('No weekly data, creating Week 1');
      await createFirstWeek(athleteId);
    } else {
      // Check if there's an active week
      const hasActiveWeek = data.some(w => w.status === 'active');
      console.log('Has active week:', hasActiveWeek);
      
      if (!hasActiveWeek) {
        const lastWeek = data[0];
        console.log('No active week, creating next week:', lastWeek.week_num + 1);
        await createNewWeek(athleteId, lastWeek.week_num + 1);
      }
    }
  };

  const createFirstWeek = async (athleteId) => {
    console.log('Creating first week for athlete:', athleteId);
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday

    const newWeek = {
      athlete_id: athleteId,
      week_num: 1,
      date_start: startOfWeek.toISOString().split('T')[0],
      date_end: endOfWeek.toISOString().split('T')[0],
      status: 'active',
      total_volume: 0
    };

    console.log('Creating week:', newWeek);
    const inserted = await api.fetch('weekly_data', {
      method: 'POST',
      body: JSON.stringify(newWeek)
    });

    console.log('Week created:', inserted);
    if (inserted && inserted[0]) {
      setWeeklyData([inserted[0]]);
    }
  };

  const createNewWeek = async (athleteId, weekNum) => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const newWeek = {
      athlete_id: athleteId,
      week_num: weekNum,
      date_start: startOfWeek.toISOString().split('T')[0],
      date_end: endOfWeek.toISOString().split('T')[0],
      status: 'active',
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

  const selectAthlete = async (athlete) => {
    setSelectedAthlete(athlete);
    if (!athlete.baseline_vo2 || !athlete.target_vo2) {
      setView('profile-setup');
    } else {
      await loadAthleteData(athlete.id);
      setView('athlete-portal');
      setNavView('current');
    }
  };

  const saveProfile = async (profileData) => {
    console.log('Saving profile:', profileData);
    try {
      await api.fetch(`athletes?id=eq.${selectedAthlete.id}`, {
        method: 'PATCH',
        body: JSON.stringify(profileData)
      });
      
      setSelectedAthlete({ ...selectedAthlete, ...profileData });
      
      // Update user in localStorage if it's their own profile
      if (currentUser.athlete_id === selectedAthlete.id) {
        const updatedUser = { ...currentUser, athlete: { ...selectedAthlete, ...profileData } };
        setCurrentUser(updatedUser);
        localStorage.setItem('speedandform_user', JSON.stringify(updatedUser));
      }
      
      await loadAthleteData(selectedAthlete.id);
      setView('athlete-portal');
      setNavView('current');
    } catch (error) {
      console.error('Error saving profile:', error);
      setError('Failed to save profile');
    }
  };

  const updateField = async (weekId, field, value) => {
    console.log('Updating field:', weekId, field, value);
    await api.fetch(`weekly_data?id=eq.${weekId}`, {
      method: 'PATCH',
      body: JSON.stringify({ [field]: value })
    });
    setWeeklyData(weeklyData.map(w => w.id === weekId ? { ...w, [field]: value } : w));
  };

  const validateWeek = (week) => {
    const required = {
      vo2_max: week.vo2_max,
      resting_hr: week.resting_hr,
      total_volume: week.total_volume
    };

    const missingFields = Object.entries(required)
      .filter(([key, value]) => !value || value === '' || value === 0)
      .map(([key]) => key.replace('_', ' ').toUpperCase());

    if (missingFields.length > 0) {
      return {
        valid: false,
        missing: missingFields
      };
    }

    return { valid: true, warnings: [] };
  };

  const handleCompleteWeek = () => {
    const activeWeek = weeklyData.find(w => w.status === 'active');
    if (!activeWeek) {
      setError('No active week found');
      return;
    }

    const validation = validateWeek(activeWeek);
    
    if (!validation.valid) {
      setError(`Please fill in required fields: ${validation.missing.join(', ')}`);
      return;
    }

    setShowCompleteModal(true);
    setError('');
  };

  const confirmCompleteWeek = async () => {
    const activeWeek = weeklyData.find(w => w.status === 'active');
    if (!activeWeek) return;

    console.log('Completing week:', activeWeek.week_num);

    try {
      // Mark week as completed
      await api.fetch(`weekly_data?id=eq.${activeWeek.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
      });

      // Create next week
      await createNewWeek(selectedAthlete.id, activeWeek.week_num + 1);

      // Reload data
      await loadAthleteData(selectedAthlete.id);

      setShowCompleteModal(false);
      setError('');
    } catch (error) {
      console.error('Error completing week:', error);
      setError('Failed to complete week');
    }
  };

  const deleteWeek = async (weekId) => {
    if (confirm('Are you sure you want to delete this week?')) {
      await api.fetch(`weekly_data?id=eq.${weekId}`, {
        method: 'DELETE'
      });
      setWeeklyData(weeklyData.filter(w => w.id !== weekId));
    }
  };

  // Profile Setup Component
  const ProfileSetup = () => {
    const [profile, setProfile] = useState({
      age: selectedAthlete?.age || '',
      starting_weight: selectedAthlete?.starting_weight || '',
      baseline_vo2: selectedAthlete?.baseline_vo2 || '',
      target_vo2: selectedAthlete?.target_vo2 || '',
      baseline_weekly_miles: selectedAthlete?.baseline_weekly_miles || '',
      hrv_baseline_low: selectedAthlete?.hrv_baseline_low || '',
      hrv_baseline_high: selectedAthlete?.hrv_baseline_high || ''
    });

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 text-white p-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-light tracking-wide mb-2 bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
              SETUP PROFILE
            </h1>
            <p className="text-gray-400">Complete your baseline metrics to get started</p>
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
                  placeholder="32"
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
                  placeholder="170"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Baseline VO2 *</label>
                <input
                  type="number"
                  value={profile.baseline_vo2}
                  onChange={(e) => setProfile({...profile, baseline_vo2: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                  placeholder="50"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">Target VO2 *</label>
                <input
                  type="number"
                  value={profile.target_vo2}
                  onChange={(e) => setProfile({...profile, target_vo2: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                  placeholder="60"
                  required
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
                placeholder="30"
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
                  placeholder="55"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">HRV Baseline High</label>
                <input
                  type="number"
                  value={profile.hrv_baseline_high}
                  onChange={(e) => setProfile({...profile, hrv_baseline_high: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white"
                  placeholder="75"
                />
              </div>
            </div>

            <div className="text-xs text-gray-500">* Required fields</div>

            <button
              onClick={() => saveProfile(profile)}
              disabled={!profile.baseline_vo2 || !profile.target_vo2}
              className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium uppercase tracking-wider hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save Profile & Continue
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Login View
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
                placeholder="john@example.com"
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
                placeholder="password123"
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

            <div className="mt-4 text-xs text-gray-500 text-center">
              <div>Test: john@example.com / password123</div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Profile Setup View
  if (view === 'profile-setup') {
    return <ProfileSetup />;
  }

  // Coach Dashboard
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
            {athletes.map(athlete => (
              <button
                key={athlete.id}
                onClick={() => selectAthlete(athlete)}
                className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600 transition-colors text-left"
              >
                <h3 className="text-xl font-light tracking-wide mb-4">{athlete.name}</h3>
                <div className="text-sm text-gray-400">{athlete.email}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Bottom Navigation
  const BottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 to-slate-950/95 backdrop-blur-xl border-t border-slate-800 z-[9999] safe-bottom">
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
          onClick={() => setNavView('more')}
          className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
            navView === 'more' ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <MoreVertical size={22} />
          <span className="text-xs">More</span>
        </button>
      </div>
    </div>
  );

  // Complete Week Modal
  const CompleteWeekModal = () => {
    if (!showCompleteModal) return null;
    const activeWeek = weeklyData.find(w => w.status === 'active');
    if (!activeWeek) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full">
          <h3 className="text-xl font-light mb-4">Complete Week {activeWeek.week_num}?</h3>
          
          <div className="space-y-3 mb-6">
            <div className="text-sm text-gray-400 uppercase tracking-wider mb-2">Summary</div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">VO2 Max:</span>
              <span className="text-white">{activeWeek.vo2_max || '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Resting HR:</span>
              <span className="text-white">{activeWeek.resting_hr || '-'} bpm</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Weekly Volume:</span>
              <span className="text-white">{activeWeek.total_volume || 0} mi</span>
            </div>
          </div>

          <p className="text-sm text-gray-400 mb-6">
            Week {activeWeek.week_num} will be marked complete and Week {activeWeek.week_num + 1} will become active.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setShowCompleteModal(false)}
              className="flex-1 px-4 py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmCompleteWeek}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all flex items-center justify-center gap-2"
            >
              <Check size={18} />
              Complete
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ATHLETE PORTAL VIEWS
  const isCoach = currentUser?.role === 'coach';
  const canEdit = isCoach || (currentUser?.athlete_id === selectedAthlete?.id);
  const activeWeek = weeklyData.find(w => w.status === 'active') || weeklyData[0];
  const lastWeek = weeklyData.find((w, i) => i === 1 && w.status === 'completed');
  
  const progress = selectedAthlete?.baseline_vo2 && selectedAthlete?.target_vo2 && activeWeek?.vo2_max
    ? ((activeWeek.vo2_max - selectedAthlete.baseline_vo2) / (selectedAthlete.target_vo2 - selectedAthlete.baseline_vo2) * 100).toFixed(1)
    : 0;

  const getHrvStatus = (hrv, low, high) => {
    if (!hrv || !low || !high) return { text: '-', color: 'text-gray-400' };
    if (hrv < low || hrv > high) return { text: 'Unbalanced', color: 'text-pink-400' };
    return { text: 'Balanced', color: 'text-purple-400' };
  };

  const hrvStatus = getHrvStatus(
    activeWeek?.hrv,
    selectedAthlete?.hrv_baseline_low,
    selectedAthlete?.hrv_baseline_high
  );

  // Library View
  if (navView === 'library') {
    const completedWeeks = weeklyData.filter(w => w.status === 'completed');
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 text-white p-4 pb-32">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-light mb-6">Week Library</h1>

          <div className="space-y-3">
            {activeWeek && (
              <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-purple-500/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-lg font-light">Week {activeWeek.week_num}</div>
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">ACTIVE</span>
                  </div>
                  <button
                    onClick={() => setNavView('current')}
                    className="text-purple-400 text-sm"
                  >
                    Edit →
                  </button>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {activeWeek.date_start} - {activeWeek.date_end}
                </div>
              </div>
            )}

            {completedWeeks.map(week => (
              <div 
                key={week.id}
                className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedWeek(expandedWeek === week.id ? null : week.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="text-left">
                    <div className="text-sm font-medium">Week {week.week_num}</div>
                    <div className="text-xs text-gray-500">
                      {week.date_start} - {week.date_end}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-purple-400">{week.vo2_max || '-'} VO2</div>
                    <div className="text-xs text-gray-500">{week.total_volume || '-'}mi</div>
                  </div>
                </button>

                {expandedWeek === week.id && (
                  <div className="px-4 pb-4 border-t border-slate-800 pt-4">
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <div className="text-xs text-gray-500">HR</div>
                        <div>{week.resting_hr || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">HRV</div>
                        <div>{week.hrv || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Sleep</div>
                        <div>{week.sleep_quality || '-'}/10</div>
                      </div>
                    </div>
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

  // More/Settings View
  if (navView === 'more') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 text-white p-4 pb-32">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-light mb-6">Settings</h1>

          <div className="space-y-4">
            <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-sm font-medium uppercase tracking-wider mb-4">Profile</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Name:</span>
                  <span>{selectedAthlete?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Age:</span>
                  <span>{selectedAthlete?.age || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Baseline VO2:</span>
                  <span>{selectedAthlete?.baseline_vo2}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Target VO2:</span>
                  <span>{selectedAthlete?.target_vo2}</span>
                </div>
              </div>
              <button
                onClick={() => setView('profile-setup')}
                className="w-full mt-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors"
              >
                Edit Profile
              </button>
            </div>

            <button
              onClick={logout}
              className="w-full py-3 bg-red-500/20 text-red-400 rounded-xl font-medium hover:bg-red-500/30 transition-all"
            >
              Logout
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Current Week View (Main)
  if (!activeWeek) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-gray-500 mb-4">Loading your week...</div>
          <div className="text-sm text-gray-600">Week: {view} | Nav: {navView}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 text-white p-4 pb-32">
      <div className="max-w-3xl mx-auto">
        {/* Debug Info */}
        <div className="text-xs text-gray-600 mb-4">
          View: {view} | Nav: {navView} | Week: {activeWeek?.week_num} | Status: {activeWeek?.status}
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-light">WEEK {activeWeek.week_num}</h1>
            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full uppercase tracking-wider">
              Active
            </span>
          </div>
          <p className="text-gray-500 text-sm">
            {activeWeek.date_start} - {activeWeek.date_end}
          </p>
        </div>

        {/* VO2 Progress Card */}
        <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">VO2 MAX PROGRESS</h3>
          
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-5xl font-light mb-2">{activeWeek.vo2_max || selectedAthlete?.baseline_vo2 || '-'}</div>
              <div className="text-sm text-purple-400">{progress}% Progress</div>
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
                value={activeWeek.total_volume || ''}
                onChange={(e) => canEdit && updateField(activeWeek.id, 'total_volume', e.target.value)}
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
          <h3 className="text-sm font-medium uppercase tracking-wider mb-6">SUNDAY CHECK-IN</h3>

          {/* VO2 Max Slider */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <TrendingUp size={16} />
                <span>VO2 MAX *</span>
              </div>
              <span className="text-2xl font-light">{activeWeek.vo2_max || '-'}</span>
            </div>
            <input
              type="range"
              min="40"
              max="70"
              value={activeWeek.vo2_max || 50}
              onChange={(e) => canEdit && updateField(activeWeek.id, 'vo2_max', e.target.value)}
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
                <span>RESTING HR *</span>
              </div>
              <span className="text-2xl font-light">{activeWeek.resting_hr || '-'}</span>
            </div>
            <input
              type="range"
              min="40"
              max="80"
              value={activeWeek.resting_hr || 60}
              onChange={(e) => canEdit && updateField(activeWeek.id, 'resting_hr', e.target.value)}
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
                <div className="text-2xl font-light">{activeWeek.hrv || '-'}</div>
                <div className={`text-xs ${hrvStatus.color}`}>{hrvStatus.text}</div>
              </div>
            </div>
            <input
              type="range"
              min="30"
              max="100"
              value={activeWeek.hrv || 65}
              onChange={(e) => canEdit && updateField(activeWeek.id, 'hrv', e.target.value)}
              disabled={!canEdit}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-purple"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>30</span>
              <span className="text-purple-400">Range: {selectedAthlete?.hrv_baseline_low || '-'}-{selectedAthlete?.hrv_baseline_high || '-'}</span>
              <span>100</span>
            </div>
          </div>

          {/* Sleep Quality Slider */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Activity size={16} />
                <span>SLEEP QUALITY</span>
              </div>
              <span className="text-2xl font-light">{activeWeek.sleep_quality || '-'}/10</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={activeWeek.sleep_quality || 7}
              onChange={(e) => canEdit && updateField(activeWeek.id, 'sleep_quality', e.target.value)}
              disabled={!canEdit}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-purple"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>Poor</span>
              <span className="text-gray-500">Last: {lastWeek?.sleep_quality || '-'}</span>
              <span>Great</span>
            </div>
          </div>

          <div className="text-xs text-gray-500 mt-4">* Required to complete week</div>
        </div>

        {/* Key Sessions */}
        <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-medium uppercase tracking-wider mb-4">KEY SESSIONS</h3>

          <div className="space-y-4">
            <div className="border-l-2 border-purple-500 pl-4">
              <div className="text-xs text-gray-400 uppercase mb-2">Threshold Run</div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={activeWeek.threshold_distance || ''}
                  onChange={(e) => canEdit && updateField(activeWeek.id, 'threshold_distance', e.target.value)}
                  disabled={!canEdit}
                  className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="6.2 mi"
                />
                <input
                  type="text"
                  value={activeWeek.threshold_pace || ''}
                  onChange={(e) => canEdit && updateField(activeWeek.id, 'threshold_pace', e.target.value)}
                  disabled={!canEdit}
                  className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="7:15"
                />
                <input
                  type="number"
                  value={activeWeek.threshold_hr || ''}
                  onChange={(e) => canEdit && updateField(activeWeek.id, 'threshold_hr', e.target.value)}
                  disabled={!canEdit}
                  className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="165 bpm"
                />
              </div>
            </div>

            <div className="border-l-2 border-pink-500 pl-4">
              <div className="text-xs text-gray-400 uppercase mb-2">Long Run</div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={activeWeek.long_run_distance || ''}
                  onChange={(e) => canEdit && updateField(activeWeek.id, 'long_run_distance', e.target.value)}
                  disabled={!canEdit}
                  className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="12 mi"
                />
                <input
                  type="text"
                  value={activeWeek.long_run_pace || ''}
                  onChange={(e) => canEdit && updateField(activeWeek.id, 'long_run_pace', e.target.value)}
                  disabled={!canEdit}
                  className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="7:30"
                />
                <input
                  type="number"
                  value={activeWeek.long_run_hr || ''}
                  onChange={(e) => canEdit && updateField(activeWeek.id, 'long_run_hr', e.target.value)}
                  disabled={!canEdit}
                  className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="152 bpm"
                />
              </div>
            </div>

            <div className="border-l-2 border-blue-500 pl-4">
              <div className="text-xs text-gray-400 uppercase mb-2">VO2 / Speed</div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={activeWeek.vo2_workout || ''}
                  onChange={(e) => canEdit && updateField(activeWeek.id, 'vo2_workout', e.target.value)}
                  disabled={!canEdit}
                  className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="6x800m"
                />
                <input
                  type="text"
                  value={activeWeek.vo2_pace || ''}
                  onChange={(e) => canEdit && updateField(activeWeek.id, 'vo2_pace', e.target.value)}
                  disabled={!canEdit}
                  className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="5:45"
                />
                <input
                  type="number"
                  value={activeWeek.vo2_hr || ''}
                  onChange={(e) => canEdit && updateField(activeWeek.id, 'vo2_hr', e.target.value)}
                  disabled={!canEdit}
                  className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="178 bpm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-900 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Complete Week Button */}
        <button
          onClick={handleCompleteWeek}
          className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl font-medium uppercase tracking-wider hover:shadow-lg hover:shadow-purple-500/50 transition-all mb-6 flex items-center justify-center gap-2"
        >
          <Check size={20} />
          COMPLETE WEEK
        </button>
      </div>

      <BottomNav />
      <CompleteWeekModal />

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
