import React, { useState } from 'react';
import {
  parseAndValidateTimetableImport,
  commitTimetableImport,
} from '../services/storageEngine';
import type { TimetableImportRow } from '../types';
import {
  Upload,
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';

interface TimetableUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const SAMPLE_CSV = `Room Number,Subject,Faculty,Day,Start Time,End Time,Semester
G-101,Advanced Algorithms,Prof. John Smith,1,09:00,10:30,Fall 2026
G-102,Computer Architecture,Dr. Clara Watson,2,11:00,12:30,Fall 2026
F-201,Software Engineering,Dr. Robert Lang,3,14:00,15:30,Fall 2026
F-202,Cloud Computing,Prof. Sarah Jenkins,4,09:30,11:00,Fall 2026
S-301,Compiler Design,Prof. Michael Chang,5,10:00,11:30,Fall 2026`;

export const TimetableUploadModal: React.FC<TimetableUploadModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [fileContent, setFileContent] = useState<string>('');
  const [rows, setRows] = useState<TimetableImportRow[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
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
      processText(text);
    };
    reader.readAsText(file);
  };

  const loadSample = () => {
    setFileContent(SAMPLE_CSV);
    processText(SAMPLE_CSV);
  };

  const processText = async (text: string) => {
    setError(null);
    try {
      const res = await parseAndValidateTimetableImport(text);
      setRows(res.rows);
      setValidCount(res.validCount);
      setErrorCount(res.errorCount);
      setStep('preview');
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
      setImportResult(`Successfully imported ${committed} timetable schedule events into the database.`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Import transaction failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '850px' }}
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
                <li>Header row must contain: <code>Room Number, Subject, Faculty, Day, Start Time, End Time, Semester</code></li>
                <li><strong>Day:</strong> Integer from 1 (Monday) to 7 (Sunday)</li>
                <li><strong>Times:</strong> 24-hour format <code>HH:mm</code> (e.g. <code>09:00</code>, <code>14:30</code>)</li>
                <li><strong>Conflict Verification:</strong> Automatically checks for overlapping faculty reservations. Conflicting rows will be rejected before applying.</li>
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
                onChange={(e) => {
                  setFileContent(e.target.value);
                  if (e.target.value.trim()) processText(e.target.value);
                }}
                placeholder="Paste CSV rows here..."
              />
            </div>
          </div>
        ) : (
          <div>
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
            <div style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '20px' }}>
              <table className="allocator-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Subject</th>
                    <th>Faculty</th>
                    <th>Day</th>
                    <th>Time</th>
                    <th>Status / Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const days = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700 }}>{row.room_number}</td>
                        <td>{row.subject}</td>
                        <td>{row.faculty_name}</td>
                        <td>{days[row.day_of_week] || row.day_of_week}</td>
                        <td>{row.start_time} - {row.end_time}</td>
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
