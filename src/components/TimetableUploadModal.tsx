import React, { useState } from 'react';
import {
  parseAndValidateTimetableImport,
  commitTimetableImport,
  getClassrooms,
  autoCreateMissingRoomsAndFloors,
} from '../services/storageEngine';
import type { TimetableImportRow, MissingClassroomInfo } from '../types';
import { useFeedback } from '../context/FeedbackContext';
import {
  Upload,
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  PlusCircle,
} from 'lucide-react';

interface TimetableUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const SAMPLE_CSV = `Section: BCA A
Day,Time,Room,Floor,Subject,Faculty
Monday,09:00 AM - 10:30 AM,101,First Floor,Advanced Algorithms,Prof. John Smith
Tuesday,11:00 AM - 12:30 PM,102,First Floor,Computer Architecture,Dr. Clara Watson
Wednesday,02:00 PM - 03:30 PM,201,Second Floor,Software Engineering,Dr. Robert Lang
Thursday,09:30 AM - 11:00 AM,202,Second Floor,Cloud Computing,Prof. Sarah Jenkins
Friday,10:00 AM - 11:30 AM,301,Third Floor,Compiler Design,Prof. Michael Chang
Saturday,09:00 AM - 10:30 AM,103,First Floor,Database Systems,Prof. John Smith`;

export const TimetableUploadModal: React.FC<TimetableUploadModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const { toast, confirm } = useFeedback();
  const [fileContent, setFileContent] = useState<string>('');
  const [rows, setRows] = useState<TimetableImportRow[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [missingRooms, setMissingRooms] = useState<MissingClassroomInfo[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);
      processText(text, true);
    };
    reader.readAsText(file);
  };

  const loadSample = async () => {
    try {
      const dbRooms = await getClassrooms();
      if (dbRooms.length > 0) {
        const sampleRooms = dbRooms.slice(0, 6);
        const subjects = ['Advanced Algorithms', 'Computer Architecture', 'Software Engineering', 'Cloud Computing', 'Compiler Design', 'Database Systems'];
        const faculties = ['Prof. John Smith', 'Dr. Clara Watson', 'Dr. Robert Lang', 'Prof. Sarah Jenkins', 'Prof. Michael Chang', 'Prof. John Smith'];
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const times = ['09:00 AM - 10:30 AM', '11:00 AM - 12:30 PM', '02:00 PM - 03:30 PM', '09:30 AM - 11:00 AM', '10:00 AM - 11:30 AM', '09:00 AM - 10:30 AM'];
        const generated = [
          'Section: BCA A',
          'Day,Time,Room,Floor,Subject,Faculty',
          ...sampleRooms.map((r, idx) =>
            `${days[idx % days.length]},${times[idx % times.length]},${r.room_number},${r.floor?.name || 'Main Floor'},${subjects[idx % subjects.length]},${faculties[idx % faculties.length]}`
          ),
        ].join('\n');
        setFileContent(generated);
        processText(generated, true);
        return;
      }
    } catch {
      // fallback
    }
    setFileContent(SAMPLE_CSV);
    processText(SAMPLE_CSV, true);
  };

  const handleAutoCreate = async (roomsToCreate: MissingClassroomInfo[], currentText: string) => {
    setLoading(true);
    setError(null);
    try {
      const { createdFloors, createdRooms } = await autoCreateMissingRoomsAndFloors(roomsToCreate);
      toast.success(
        `Added ${createdRooms.length} classroom(s) across ${createdFloors.length} floor(s) according to timetable data.`,
        'Floors & Classrooms Created'
      );
      // Re-validate with newly added rooms so rows become valid immediately
      await processText(currentText, false);
    } catch (err: any) {
      console.error('Failed to auto-create missing floors and classrooms:', err);
      toast.error(err.message || 'Failed to auto-create floors and classrooms.');
      setError(err.message || 'Failed to auto-create floors and classrooms.');
    } finally {
      setLoading(false);
    }
  };

  const processText = async (text: string, triggerPopup = true) => {
    setError(null);
    try {
      const res = await parseAndValidateTimetableImport(text);
      setRows(res.rows);
      setValidCount(res.validCount);
      setErrorCount(res.errorCount);
      setMissingRooms(res.missingClassrooms || []);
      setStep('preview');

      // Prompt user if unadded classrooms are detected
      if (triggerPopup && res.missingClassrooms && res.missingClassrooms.length > 0) {
        const formattedRooms = res.missingClassrooms.map((m) => `${m.room_number} (${m.floor_name || 'Main Floor'})`).join(', ');
        confirm({
          title: 'Unadded Classrooms Detected',
          message: `The timetable includes these classrooms which are not added prior: ${formattedRooms}. Do you want to add the floors/classrooms according to the timetable?`,
          confirmText: 'Yes, Add Floors & Classrooms',
          cancelText: 'No, Keep As Is',
          variant: 'primary',
          onConfirm: async () => {
            await handleAutoCreate(res.missingClassrooms, text);
          },
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to parse timetable file.');
    }
  };

  const handleCommit = async () => {
    if (validCount === 0) {
      setError('Cannot import: No valid entries found without conflicts.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const committed = await commitTimetableImport(rows);
      toast.success(
        `Successfully imported ${committed} timetable schedule events into the database.`,
        'Import Complete'
      );
      setImportResult(`Successfully imported ${committed} timetable schedule events into the database.`);
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Import transaction failed.');
      toast.error(err.message || 'Import transaction failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '920px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={24} />
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>IMPORT OFFICIAL TIMETABLE</h2>
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '4px 8px' }}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="alert-box alert-solid" style={{ marginBottom: '16px' }}>
            <AlertTriangle size={20} />
            <div>
              <div style={{ fontWeight: 700 }}>Validation Error</div>
              <div style={{ fontSize: '13px' }}>{error}</div>
            </div>
          </div>
        )}

        {importResult && (
          <div className="alert-box alert-outline" style={{ marginBottom: '16px' }}>
            <CheckCircle2 size={20} />
            <div>
              <div style={{ fontWeight: 700 }}>Import Complete</div>
              <div style={{ fontSize: '13px' }}>{importResult}</div>
            </div>
          </div>
        )}

        {step === 'upload' ? (
          <div>
            {/* Format Instruction Box */}
            <div
              style={{
                border: '2px solid var(--color-purple)',
                padding: '16px',
                borderRadius: '6px',
                marginBottom: '20px',
                fontSize: '13px',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HelpCircle size={16} />
                EXPECTED CSV FILE STRUCTURE & RULES:
              </div>
              <ul style={{ paddingLeft: '20px', lineHeight: 1.6 }}>
                <li>Header row must contain: <code>Day, Time, Room, Floor, Subject, Faculty</code> (optional <code>Section</code> column, or write <code>Section: BCA A</code> at the top).</li>
                <li><strong>Day:</strong> Text day from Monday to Saturday (e.g. <code>Monday</code> or <code>Mon</code>). Sunday is strictly disallowed.</li>
                <li><strong>Time:</strong> Combined time slot (e.g. <code>09:00 AM - 10:30 AM</code> or <code>09:00 - 10:30</code>).</li>
                <li><strong>Room & Floor:</strong> Room number and exact floor name (e.g. Room <code>101</code>, Floor <code>First Floor</code>).</li>
                <li><strong>Automatic Room & Floor Creation:</strong> If rooms in the timetable are not yet added, the system can automatically create them under the exact floor specified in the CSV.</li>
                <li><strong>Conflict Verification:</strong> Automatically checks for overlapping faculty reservations before applying.</li>
              </ul>
            </div>

            <div
              style={{
                border: '2px dashed var(--color-purple)',
                padding: '36px',
                textAlign: 'center',
                borderRadius: '6px',
                marginBottom: '20px',
              }}
            >
              <FileText size={40} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>
                Select Timetable CSV File
              </div>
              <p style={{ fontSize: '13px', opacity: 0.8, marginBottom: '16px' }}>
                Upload official semester schedule to allocate recurring classrooms
              </p>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="timetable-file-input"
              />
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <label
                  htmlFor="timetable-file-input"
                  className="btn-primary"
                  style={{ cursor: 'pointer' }}
                >
                  <Upload size={16} />
                  Choose CSV File
                </label>
                <button type="button" onClick={loadSample} className="btn-secondary">
                  Load Pre-filled Sample CSV
                </button>
              </div>
            </div>

            {/* Direct Text Area */}
            <div>
              <label>Or Paste CSV Contents Directly:</label>
              <textarea
                rows={6}
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                placeholder="Paste CSV rows here..."
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!fileContent.trim()}
                  onClick={() => processText(fileContent, true)}
                >
                  Preview & Validate Pasted CSV
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* Unadded Classrooms Banner */}
            {missingRooms.length > 0 && (
              <div
                className="alert-box alert-solid"
                style={{
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  padding: '12px 16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertTriangle size={20} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>
                      Unadded Classrooms in Timetable:
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.9 }}>
                      {missingRooms.map((m) => `${m.room_number} (${m.floor_name})`).join(', ')} (not yet created in database)
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    padding: '6px 14px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-primary-dark)',
                    borderColor: 'var(--color-surface)',
                  }}
                  disabled={loading}
                  onClick={() => handleAutoCreate(missingRooms, fileContent)}
                >
                  <PlusCircle size={15} />
                  {loading ? 'Creating...' : 'Add Floors & Classrooms Now'}
                </button>
              </div>
            )}

            {/* Preview Summary */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                border: '2px solid var(--color-purple)',
                borderRadius: '6px',
                marginBottom: '16px',
              }}
            >
              <div>
                <span style={{ fontWeight: 700 }}>Total Rows Parsed:</span> {rows.length} |{' '}
                <span style={{ fontWeight: 700 }}>Valid:</span> {validCount} |{' '}
                <span style={{ fontWeight: 700 }}>Conflicts/Errors:</span> {errorCount}
              </div>
              <button
                onClick={() => setStep('upload')}
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '12px' }}
              >
                Change File / Re-upload
              </button>
            </div>

            {/* Rows Table */}
            <div className="table-responsive" style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '20px' }}>
              <table className="allocator-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Room</th>
                    <th>Floor</th>
                    <th>Subject</th>
                    <th>Faculty</th>
                    <th>Section</th>
                    <th>Status / Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const days = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700 }}>{days[row.day_of_week] || (row.day_of_week === 7 ? 'Sun (Invalid)' : row.day_of_week)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{row.start_time ? `${row.start_time} - ${row.end_time}` : '—'}</td>
                        <td style={{ fontWeight: 700 }}>{row.room_number}</td>
                        <td>{row.floor_name || '—'}</td>
                        <td>{row.subject}</td>
                        <td>{row.faculty_name}</td>
                        <td>
                          {row.section ? (
                            <span className="badge-outline" style={{ fontWeight: 700, fontSize: '11px' }}>
                              {row.section}
                            </span>
                          ) : (
                            <span style={{ opacity: 0.5 }}>—</span>
                          )}
                        </td>
                        <td>
                          {row.error ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                              <AlertTriangle size={14} />
                              {row.error}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={14} />
                              Valid Entry
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="btn-secondary"
                disabled={loading}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCommit}
                className="btn-primary"
                disabled={loading || validCount === 0}
              >
                {loading ? 'Importing...' : `Commit ${validCount} Valid Timetable Entries`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

