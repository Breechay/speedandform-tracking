import React, { useState, useEffect } from 'react';
import { ArrowLeft, Download, Eye, EyeOff } from 'lucide-react';

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
          await loadAthleteData(user.athlete_id);
          setView('athlete-portal');
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
    const data = await api.fetch(`weekly_data?athlete_id=eq.${athleteId}&select=*&order=week_num.asc`);
    setWeeklyData(data || []);
  };

  const selectAthlete = async (athlete) => {
    setSelectedAthlete(athlete);
    await loadAthleteData(athlete.id);
    setView('athlete-detail');
  };

  const addWeek = async () => {
    const lastWeek = weeklyData[weeklyData.length - 1];
    const newWeek = {
      athlete_id: selectedAthlete.id,
      week_num: lastWeek ? lastWeek.week_num + 1 : 1
    };

    const inserted = await api.fetch('weekly_data', {
      method: 'POST',
      body: JSON.stringify(newWeek)
    });

    if (inserted && inserted[0]) {
      setWeeklyData([...weeklyData, inserted[0]]);
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

  const exportCSV = () => {
    const headers = [
      "Week", "Date", "VO2", "HR", "HRV", "Volume", "Aerobic Load",
      "Mon Dur", "Mon HR", "Mon Pace", "Mon Zones", "Mon Notes",
      "Tue Work", "Tue Pace", "Tue HR", "Tue Max", "Tue Rec", "Tue Notes",
      "Thu Work", "Thu Pace", "Thu HR", "Thu Max", "Thu Rec", "Thu Notes",
      "Sat Dist", "Sat Pace", "Sat HR", "Sat Notes",
      "Easy", "Stairs", "Form", "Observations", "Coach Notes"
    ];

    const rows = weeklyData.map(w => [
      w.week_num, w.date_range || '', w.vo2_max || '', w.resting_hr || '', w.hrv || '',
      w.total_volume || '', w.low_aerobic_load || '',
      w.monday_duration || '', w.monday_avg_hr || '', w.monday_pace || '', w.monday_hr_zones || '', w.monday_notes || '',
      w.tuesday_workout || '', w.tuesday_avg_pace || '', w.tuesday_avg_hr || '', w.tuesday_max_hr || '', w.tuesday_recovery_hr || '', w.tuesday_notes || '',
      w.thursday_workout || '', w.thursday_avg_pace || '', w.thursday_avg_hr || '', w.thursday_max_hr || '', w.thursday_recovery_hr || '', w.thursday_notes || '',
      w.saturday_distance || '', w.saturday_avg_pace || '', w.saturday_avg_hr || '', w.saturday_notes || '',
      w.easy_miles || '', w.stairmaster_sessions || '', w.form_notes || '', w.weekly_observations || '', w.coach_notes || ''
    ].map(v => `"${v}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedAthlete.slug}_data.csv`;
    a.click();
  };

  const logout = () => {
    setCurrentUser(null);
    setView('login');
    setEmail('');
    setPassword('');
  };

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-light mb-2">Speed & Form</h1>
            <p className="text-gray-400">Athlete Tracking Platform</p>
          </div>

          <form onSubmit={login} className="bg-gray-900 border border-gray-800 p-8">
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border border-gray-800 px-4 py-3 text-white"
                placeholder="your@email.com"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-gray-800 px-4 py-3 text-white"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900 border border-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black py-3 font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (view === 'coach-dashboard') {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-light mb-2">Coach Dashboard</h1>
              <p className="text-gray-400">Welcome back</p>
            </div>
            <button onClick={logout} className="text-gray-400 hover:text-white text-sm">
              Logout
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {athletes.map(athlete => {
              const progress = athlete.baseline_vo2 && athlete.current_vo2 && athlete.target_vo2
                ? ((athlete.current_vo2 - athlete.baseline_vo2) / (athlete.target_vo2 - athlete.baseline_vo2) * 100).toFixed(1)
                : 0;

              return (
                <div key={athlete.id} className="bg-gray-900 border border-gray-800 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-light">{athlete.name}</h3>
                    <button
                      onClick={() => togglePublic(athlete.id, athlete.is_public)}
                      className="text-gray-400 hover:text-white"
                    >
                      {athlete.is_public ? <Eye size={18} /> : <EyeOff size={18} />}
                    </button>
                  </div>
                  
                  {athlete.current_vo2 ? (
                    <>
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Current VO2</span>
                          <span className="text-green-400">{athlete.current_vo2}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Target VO2</span>
                          <span>{athlete.target_vo2}</span>
                        </div>
                      </div>

                      <div className="w-full bg-gray-800 h-2 mb-4">
                        <div 
                          className="bg-green-500 h-2"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-500 text-sm mb-4">No baseline data yet</div>
                  )}

                  <button
                    onClick={() => selectAthlete(athlete)}
                    className="w-full bg-white text-black py-2 text-sm hover:bg-gray-200"
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

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 border-b border-gray-800 pb-6">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              {isCoach && (
                <button
                  onClick={() => setView('coach-dashboard')}
                  className="flex items-center gap-2 text-gray-400 hover:text-white"
                >
                  <ArrowLeft size={20} /> Dashboard
                </button>
              )}
            </div>
            <button onClick={logout} className="text-gray-400 hover:text-white text-sm">
              Logout
            </button>
          </div>

          <h1 className="text-3xl font-light mt-4">{selectedAthlete?.name}</h1>
        </div>

        {weeklyData.map(week => (
          <div key={week.id} className="mb-8 border border-gray-800 p-6">
            <h2 className="text-xl font-light mb-4">Week {week.week_num}</h2>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <input
                type="text"
                value={week.date_range || ''}
                onChange={(e) => canEdit && updateField(week.id, 'date_range', e.target.value)}
                disabled={!canEdit}
                placeholder="Date Range"
                className="bg-gray-900 border border-gray-800 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={week.vo2_max || ''}
                onChange={(e) => canEdit && updateField(week.id, 'vo2_max', e.target.value)}
                disabled={!canEdit}
                placeholder="VO2 Max"
                className="bg-gray-900 border border-gray-800 px-3 py-2 text-sm"
              />
              <input
                type="number"
                value={week.resting_hr || ''}
                onChange={(e) => canEdit && updateField(week.id, 'resting_hr', e.target.value)}
                disabled={!canEdit}
                placeholder="Resting HR"
                className="bg-gray-900 border border-gray-800 px-3 py-2 text-sm"
              />
            </div>
          </div>
        ))}

        <div className="flex gap-4">
          {canEdit && (
            <button
              onClick={addWeek}
              className="px-6 py-3 bg-white text-black text-sm hover:bg-gray-200"
            >
              Add Week
            </button>
          )}
          <button
            onClick={exportCSV}
            className="px-6 py-3 bg-gray-900 border border-gray-800 text-sm hover:bg-gray-800 flex items-center gap-2"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
