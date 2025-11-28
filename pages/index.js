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
    const data = await api.fetch(`weekly_data?athlete_id=eq.${athleteId}&select=*&order=week_num.desc`);
    setWeeklyData(data || []);
  };

  const selectAthlete = async (athlete) => {
    setSelectedAthlete(athlete);
    await loadAthleteData(athlete.id);
    setView('athlete-detail');
  };

  const addWeek = async () => {
    const lastWeek = weeklyData[0];
    const newWeek = {
      athlete_id: selectedAthlete.id,
      week_num: lastWeek ? lastWeek.week_num + 1 : 1,
      date: new Date().toISOString().split('T')[0],
      injury_status: 'none'
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

  const exportCSV = () => {
    const headers = ["Week", "Date", "VO2", "HR", "HRV", "Weight", "Sleep", "Motivation", "Volume"];
    const rows = weeklyData.map(w => [
      w.week_num, w.date || '', w.vo2_max || '', w.resting_hr || '', w.hrv || '', w.weight || '',
      w.sleep_quality || '', w.motivation_level || '', w.total_volume || ''
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
            <h1 className="text-4xl font-light mb-2 tracking-wide">SPEED & FORM</h1>
            <p className="text-gray-500 text-sm uppercase tracking-widest">Athlete Tracking</p>
          </div>

          <form onSubmit={login} className="bg-zinc-900 border border-zinc-800 p-8">
            <div className="mb-6">
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border border-zinc-800 px-4 py-3 text-white text-sm"
                required
              />
            </div>

            <div className="mb-6">
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-zinc-800 px-4 py-3 text-white text-sm"
                required
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-900 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black py-3 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 uppercase tracking-wider"
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
          <div className="flex justify-between items-center mb-8 pb-6 border-b border-zinc-800">
            <div>
              <h1 className="text-3xl font-light tracking-wide">COACH DASHBOARD</h1>
              <p className="text-gray-500 text-sm mt-1">Welcome back</p>
            </div>
            <button onClick={logout} className="text-gray-500 hover:text-white text-sm uppercase tracking-wider">
              Logout
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {athletes.map(athlete => {
              const progress = athlete.baseline_vo2 && athlete.current_vo2 && athlete.target_vo2
                ? ((athlete.current_vo2 - athlete.baseline_vo2) / (athlete.target_vo2 - athlete.baseline_vo2) * 100).toFixed(1)
                : 0;

              return (
                <div key={athlete.id} className="bg-zinc-900 border border-zinc-800 p-6 hover:border-zinc-700 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-light tracking-wide">{athlete.name}</h3>
                    <button
                      onClick={() => togglePublic(athlete.id, athlete.is_public)}
                      className="text-gray-500 hover:text-white"
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
                          <span className="text-white">{progress}%</span>
                        </div>
                      </div>

                      <div className="w-full bg-zinc-800 h-1 mb-4">
                        <div 
                          className="bg-white h-1 transition-all"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-600 text-sm mb-4">No baseline data</div>
                  )}

                  <button
                    onClick={() => selectAthlete(athlete)}
                    className="w-full bg-white text-black py-2 text-sm font-medium hover:bg-gray-200 uppercase tracking-wider"
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
return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 pb-6 border-b border-zinc-800">
          <div className="flex justify-between items-start mb-4">
            {isCoach && (
              <button
                onClick={() => setView('coach-dashboard')}
                className="flex items-center gap-2 text-gray-500 hover:text-white text-sm uppercase tracking-wider"
              >
                <ArrowLeft size={18} /> Dashboard
              </button>
            )}
            <button onClick={logout} className="ml-auto text-gray-500 hover:text-white text-sm uppercase tracking-wider">
              Logout
            </button>
          </div>

          <h1 className="text-3xl font-light tracking-wide mb-2">{selectedAthlete?.name}</h1>
          
          {selectedAthlete?.baseline_vo2 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-zinc-900 p-4 border border-zinc-800">
                <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Baseline VO2</div>
                <div className="text-2xl font-light">{selectedAthlete.baseline_vo2}</div>
              </div>
              <div className="bg-zinc-900 p-4 border border-zinc-800">
                <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Current VO2</div>
                <div className="text-2xl font-light">{selectedAthlete.current_vo2}</div>
              </div>
              <div className="bg-zinc-900 p-4 border border-zinc-800">
                <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Target VO2</div>
                <div className="text-2xl font-light">{selectedAthlete.target_vo2}</div>
              </div>
              <div className="bg-zinc-900 p-4 border border-zinc-800">
                <div className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Progress</div>
                <div className="text-2xl font-light">{progress}%</div>
              </div>
            </div>
          )}
        </div>

        {weeklyData.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No training data yet</p>
            {canEdit && (
              <button
                onClick={addWeek}
                className="px-6 py-3 bg-white text-black text-sm font-medium hover:bg-gray-200 uppercase tracking-wider"
              >
                Add First Week
              </button>
            )}
          </div>
        ) : (
          <>
            {weeklyData.map(week => (
              <div key={week.id} className="mb-8 bg-zinc-900 border border-zinc-800 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-light tracking-wide">Week {week.week_num}</h2>
                  <input
                    type="date"
                    value={week.date || ''}
                    onChange={(e) => canEdit && updateField(week.id, 'date', e.target.value)}
                    disabled={!canEdit}
                    className="bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50"
                  />
                </div>

                <div className="mb-6">
                  <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-4">Sunday Check-in</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">VO2 Max</label>
                      <input
                        type="number"
                        value={week.vo2_max || ''}
                        onChange={(e) => canEdit && updateField(week.id, 'vo2_max', e.target.value)}
                        disabled={!canEdit}
                        className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Resting HR</label>
                      <input
                        type="number"
                        value={week.resting_hr || ''}
                        onChange={(e) => canEdit && updateField(week.id, 'resting_hr', e.target.value)}
                        disabled={!canEdit}
                        className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">HRV</label>
                      <input
                        type="number"
                        value={week.hrv || ''}
                        onChange={(e) => canEdit && updateField(week.id, 'hrv', e.target.value)}
                        disabled={!canEdit}
                        className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Weight</label>
                      <input
                        type="number"
                        step="0.1"
                        value={week.weight || ''}
                        onChange={(e) => canEdit && updateField(week.id, 'weight', e.target.value)}
                        disabled={!canEdit}
                        className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Sleep (1-10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={week.sleep_quality || ''}
                        onChange={(e) => canEdit && updateField(week.id, 'sleep_quality', e.target.value)}
                        disabled={!canEdit}
                        className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Motivation (1-10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={week.motivation_level || ''}
                        onChange={(e) => canEdit && updateField(week.id, 'motivation_level', e.target.value)}
                        disabled={!canEdit}
                        className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Soreness (1-10)</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={week.soreness_level || ''}
                        onChange={(e) => canEdit && updateField(week.id, 'soreness_level', e.target.value)}
                        disabled={!canEdit}
                        className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Injury Status</label>
                      <select
                        value={week.injury_status || 'none'}
                        onChange={(e) => canEdit && updateField(week.id, 'injury_status', e.target.value)}
                        disabled={!canEdit}
                        className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50"
                      >
                        <option value="none">None</option>
                        <option value="minor">Minor</option>
                        <option value="managing">Managing</option>
                        <option value="recovering">Recovering</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-3">Threshold</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <input type="text" placeholder="Duration" value={week.threshold_duration || ''} onChange={(e) => canEdit && updateField(week.id, 'threshold_duration', e.target.value)} disabled={!canEdit} className="bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50" />
                      <input type="number" step="0.1" placeholder="Miles" value={week.threshold_miles || ''} onChange={(e) => canEdit && updateField(week.id, 'threshold_miles', e.target.value)} disabled={!canEdit} className="bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50" />
                      <input type="text" placeholder="Pace" value={week.threshold_pace || ''} onChange={(e) => canEdit && updateField(week.id, 'threshold_pace', e.target.value)} disabled={!canEdit} className="bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50" />
                      <input type="number" placeholder="Avg HR" value={week.threshold_avg_hr || ''} onChange={(e) => canEdit && updateField(week.id, 'threshold_avg_hr', e.target.value)} disabled={!canEdit} className="bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-3">Speed/VO2</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <input type="text" placeholder="Workout" value={week.speed_workout || ''} onChange={(e) => canEdit && updateField(week.id, 'speed_workout', e.target.value)} disabled={!canEdit} className="bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50" />
                      <input type="text" placeholder="Pace" value={week.speed_pace || ''} onChange={(e) => canEdit && updateField(week.id, 'speed_pace', e.target.value)} disabled={!canEdit} className="bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50" />
                      <input type="number" placeholder="Avg HR" value={week.speed_avg_hr || ''} onChange={(e) => canEdit && updateField(week.id, 'speed_avg_hr', e.target.value)} disabled={!canEdit} className="bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50" />
                      <input type="number" placeholder="Recovery HR" value={week.speed_recovery_hr || ''} onChange={(e) => canEdit && updateField(week.id, 'speed_recovery_hr', e.target.value)} disabled={!canEdit} className="bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-3">Long Run</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <input type="text" placeholder="Duration" value={week.long_run_duration || ''} onChange={(e) => canEdit && updateField(week.id, 'long_run_duration', e.target.value)} disabled={!canEdit} className="bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50" />
                      <input type="number" step="0.1" placeholder="Miles" value={week.long_run_miles || ''} onChange={(e) => canEdit && updateField(week.id, 'long_run_miles', e.target.value)} disabled={!canEdit} className="bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50" />
                      <input type="text" placeholder="Pace" value={week.long_run_pace || ''} onChange={(e) => canEdit && updateField(week.id, 'long_run_pace', e.target.value)} disabled={!canEdit} className="bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50" />
                      <input type="number" placeholder="Avg HR" value={week.long_run_avg_hr || ''} onChange={(e) => canEdit && updateField(week.id, 'long_run_avg_hr', e.target.value)} disabled={!canEdit} className="bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-sm text-gray-500 uppercase tracking-wider mb-3">Volume & Load</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Total Volume (miles)</label>
                      <input type="number" step="0.1" value={week.total_volume || ''} onChange={(e) => canEdit && updateField(week.id, 'total_volume', e.target.value)} disabled={!canEdit} className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Garmin Load Focus (URL)</label>
                      <input type="url" placeholder="https://..." value={week.garmin_load_focus_url || ''} onChange={(e) => canEdit && updateField(week.id, 'garmin_load_focus_url', e.target.value)} disabled={!canEdit} className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Garmin VO2 Graph (URL)</label>
                      <input type="url" placeholder="https://..." value={week.garmin_vo2_graph_url || ''} onChange={(e) => canEdit && updateField(week.id, 'garmin_vo2_graph_url', e.target.value)} disabled={!canEdit} className="w-full bg-black border border-zinc-800 px-3 py-2 text-sm disabled:opacity-50" />
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-gray-500 uppercase tracking-wider mb-2">Weekly Observations</label>
                  <textarea value={week.weekly_observations || ''} onChange={(e) => canEdit && updateField(week.id, 'weekly_observations', e.target.value)} disabled={!canEdit} placeholder="Key sessions, how they felt..." className="w-full bg-black border border-zinc-800 px-4 py-3 text-sm h-24 disabled:opacity-50" />
                </div>

                {isCoach && (
                  <div>
                    <label className="block text-sm text-gray-500 uppercase tracking-wider mb-2">Coach Notes (Private)</label>
                    <textarea value={week.coach_notes || ''} onChange={(e) => updateField(week.id, 'coach_notes', e.target.value)} placeholder="Your private notes..." className="w-full bg-black border border-amber-900/30 px-4 py-3 text-sm h-24" />
                  </div>
                )}
              </div>
            ))}

            <div className="flex gap-4 flex-wrap">
              {canEdit && (
                <button onClick={addWeek} className="px-6 py-3 bg-white text-black text-sm font-medium hover:bg-gray-200 uppercase tracking-wider">
                  Add Week
                </button>
              )}
              <button onClick={exportCSV} className="px-6 py-3 bg-zinc-900 border border-zinc-800 text-sm hover:bg-zinc-800 flex items-center gap-2 uppercase tracking-wider">
                <Download size={16} /> Export CSV
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
