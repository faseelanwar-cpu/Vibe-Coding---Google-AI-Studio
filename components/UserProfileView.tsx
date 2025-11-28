
import React, { useState, useEffect } from 'react';
import { CandidateProfile, WorkExperience, Education, Project, Certification, DocumentData } from '../types';
import { saveCandidateProfile, getCandidateProfile } from '../services/dbService';
import { parseCVToProfile } from '../services/geminiService';
import { fileToBase64 } from '../utils/fileUtils';
import { SpinnerIcon, FileUploadIcon, CheckCircleIcon, TrashIcon, XIcon, ListIcon, PlusIcon, TextIcon } from './icons';

interface UserProfileViewProps {
  userId: string; // email
}

// Initial empty state
const emptyProfile: CandidateProfile = {
    personalInfo: { name: '', email: '', phone: '', location: '', linkedin: '', portfolio: '' },
    summary: '',
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: []
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 60 }, (_, i) => CURRENT_YEAR + 5 - i);

const UserProfileView: React.FC<UserProfileViewProps> = ({ userId }) => {
  const [profile, setProfile] = useState<CandidateProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  
  // State for adding new skills
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
      loadProfile();
  }, [userId]);

  // Helper to generate robust ID
  const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

  const loadProfile = async () => {
      setLoading(true);
      const data = await getCandidateProfile(userId);
      if (data) {
          // DATA PATCHING: Ensure every item has an ID and migrate legacy data
          const patchedData = { ...data };
          
          if (patchedData.experience) patchedData.experience = patchedData.experience.map(e => ({ ...e, id: e.id || generateId() }));
          
          if (patchedData.education) {
             // Migrate education that might be missing new fields
             patchedData.education = patchedData.education.map((e: any) => ({
                 id: e.id || generateId(),
                 institution: e.institution || '',
                 degree: e.degree || '',
                 major: e.major || '',
                 startDate: e.startDate || '',
                 endDate: e.endDate || e.year || '', // Fallback to year if exists
                 description: e.description || ''
             }));
          }
          
          if (patchedData.projects) patchedData.projects = patchedData.projects.map(e => ({ ...e, id: e.id || generateId() }));
          
          if (!patchedData.skills) patchedData.skills = []; 
          
          // Migrate Certifications: string[] -> Certification[]
          if (patchedData.certifications && patchedData.certifications.length > 0) {
              if (typeof patchedData.certifications[0] === 'string') {
                  // Legacy strings
                  patchedData.certifications = (patchedData.certifications as unknown as string[]).map(c => ({
                      id: generateId(),
                      name: c,
                      issuer: '',
                      startDate: '',
                      expirationDate: '',
                      credentialId: '',
                      url: ''
                  }));
              } else {
                   patchedData.certifications = patchedData.certifications.map(c => ({ ...c, id: c.id || generateId() }));
              }
          } else {
              patchedData.certifications = [];
          }

          setProfile(patchedData);
      } else {
          setProfile(p => ({ ...p, personalInfo: { ...p.personalInfo, email: userId } }));
      }
      setLoading(false);
  };

  const handleSave = async () => {
      setSaving(true);
      try {
          await saveCandidateProfile(userId, profile);
          showMessage("Profile saved successfully!", "success");
      } catch (e) {
          console.error(e);
          showMessage("Failed to save profile.", "error");
      } finally {
          setSaving(false);
      }
  };
  
  const handleReset = () => {
      setProfile({ ...emptyProfile, personalInfo: { ...emptyProfile.personalInfo, email: userId } });
      showMessage("Profile reset.", "success");
  };

  const showMessage = (msg: string, type: 'success' | 'error') => {
      setMessage(msg);
      setTimeout(() => setMessage(null), 3000);
  };

  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setParsing(true);
          try {
              const { base64, mimeType } = await fileToBase64(file);
              const cvDoc: DocumentData = { base64, mimeType, name: file.name };
              
              const parsedProfile = await parseCVToProfile(cvDoc);
              
              // Ensure parsed items have IDs and defaults
              if (parsedProfile.experience) parsedProfile.experience.forEach(e => e.id = e.id || generateId());
              if (parsedProfile.education) parsedProfile.education.forEach(e => {
                  e.id = e.id || generateId();
                  e.major = e.major || '';
                  e.startDate = e.startDate || '';
                  e.endDate = e.endDate || '';
              });
              if (parsedProfile.projects) parsedProfile.projects.forEach(e => e.id = e.id || generateId());
              if (!parsedProfile.skills) parsedProfile.skills = [];
              if (parsedProfile.certifications) parsedProfile.certifications.forEach(c => {
                  c.id = c.id || generateId();
                  c.issuer = c.issuer || '';
                  c.startDate = c.startDate || '';
              });

              // Merge parsed data
              setProfile({
                  ...parsedProfile,
                  personalInfo: { ...parsedProfile.personalInfo, email: profile.personalInfo.email || parsedProfile.personalInfo.email }
              });
              showMessage("Profile populated from CV!", "success");
          } catch (err) {
              console.error(err);
              showMessage("Failed to parse CV.", "error");
          } finally {
              setParsing(false);
          }
      }
  };

  const handleInfoChange = (field: keyof typeof profile.personalInfo, value: string) => {
      setProfile(p => ({ ...p, personalInfo: { ...p.personalInfo, [field]: value } }));
  };

  // Experience Handlers
  const addExperience = () => {
      const newExp: WorkExperience = { id: generateId(), company: '', role: '', startDate: '', endDate: '', description: '' };
      setProfile(p => ({ ...p, experience: [newExp, ...p.experience] }));
  };
  
  const updateExperience = (id: string, field: keyof WorkExperience, value: string) => {
      setProfile(p => ({
          ...p,
          experience: p.experience.map(e => e.id === id ? { ...e, [field]: value } : e)
      }));
  };

  const removeExperience = (id: string) => {
      setProfile(p => ({ ...p, experience: p.experience.filter(e => e.id !== id) }));
  };

  // Education Handlers
  const addEducation = () => {
      const newEdu: Education = { id: generateId(), institution: '', degree: '', major: '', startDate: '', endDate: '', description: '' };
      setProfile(p => ({ ...p, education: [newEdu, ...p.education] }));
  };

  const updateEducation = (id: string, field: keyof Education, value: string) => {
      setProfile(p => ({
          ...p,
          education: p.education.map(e => e.id === id ? { ...e, [field]: value } : e)
      }));
  };

  const removeEducation = (id: string) => {
      setProfile(p => ({ ...p, education: p.education.filter(e => e.id !== id) }));
  };

  // Projects Handlers
  const addProject = () => {
      const newProj: Project = { id: generateId(), name: '', description: '', link: '' };
      setProfile(p => ({ ...p, projects: [newProj, ...p.projects] }));
  };

  const updateProject = (id: string, field: keyof Project, value: string) => {
      setProfile(p => ({
          ...p,
          projects: p.projects.map(p => p.id === id ? { ...p, [field]: value } : p)
      }));
  };

  const removeProject = (id: string) => {
      setProfile(p => ({ ...p, projects: p.projects.filter(p => p.id !== id) }));
  };

  // Skills Handlers
  const handleAddSkill = () => {
      const cleanSkill = newSkill.trim();
      if (cleanSkill && !profile.skills.includes(cleanSkill)) {
          setProfile(p => ({ ...p, skills: [...p.skills, cleanSkill] }));
          setNewSkill('');
      }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
      setProfile(p => ({ ...p, skills: p.skills.filter(s => s !== skillToRemove) }));
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          handleAddSkill();
      }
  };

  // Certifications Handlers
  const addCertification = () => {
      const newCert: Certification = { id: generateId(), name: '', issuer: '', startDate: '', expirationDate: '', credentialId: '', url: '' };
      setProfile(p => ({ ...p, certifications: [newCert, ...p.certifications] }));
  };

  const updateCertification = (id: string, field: keyof Certification, value: string) => {
      setProfile(p => ({
          ...p,
          certifications: p.certifications.map(c => c.id === id ? { ...c, [field]: value } : c)
      }));
  };

  const removeCertification = (id: string) => {
      setProfile(p => ({ ...p, certifications: p.certifications.filter(c => c.id !== id) }));
  };

  if (loading) return <div className="flex justify-center p-20"><SpinnerIcon /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
            <h1 className="text-3xl font-bold text-slate-50">Your Career Profile</h1>
            <p className="text-slate-400 mt-1">Structured data for better interview context.</p>
        </div>
        <div className="flex flex-wrap gap-3">
            <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-indigo-300 transition-colors">
                {parsing ? <SpinnerIcon /> : <FileUploadIcon />}
                {parsing ? "Parsing..." : "Import PDF"}
                <input type="file" accept=".pdf" className="hidden" onChange={handleCVUpload} disabled={parsing} />
            </label>
            <button 
                type="button"
                onClick={handleReset} 
                className="px-4 py-2 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-300 rounded-lg text-sm transition-colors"
            >
                Reset
            </button>
            <button 
                type="button"
                onClick={handleSave} 
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors"
            >
                {saving ? <SpinnerIcon /> : <CheckCircleIcon />}
                {saving ? "Saving..." : "Save Profile"}
            </button>
        </div>
      </div>

      {message && (
          <div className={`fixed top-20 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${message.includes('success') ? 'bg-green-600' : 'bg-red-600'} text-white animate-fade-in`}>
              {message}
          </div>
      )}

      <div className="space-y-8">
          
          {/* Personal Info */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-4 text-indigo-400">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Full Name" value={profile.personalInfo.name} onChange={v => handleInfoChange('name', v)} />
                  <Input label="Email" value={profile.personalInfo.email} onChange={v => handleInfoChange('email', v)} disabled />
                  <Input label="Phone" value={profile.personalInfo.phone} onChange={v => handleInfoChange('phone', v)} />
                  <Input label="Location" value={profile.personalInfo.location || ''} onChange={v => handleInfoChange('location', v)} />
                  <Input label="LinkedIn URL" value={profile.personalInfo.linkedin || ''} onChange={v => handleInfoChange('linkedin', v)} />
                  <Input label="Portfolio / Website" value={profile.personalInfo.portfolio || ''} onChange={v => handleInfoChange('portfolio', v)} />
              </div>
          </div>

          {/* Summary */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-4 text-indigo-400">Professional Summary</h2>
              <textarea 
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 min-h-[100px] text-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={profile.summary}
                  onChange={e => setProfile(p => ({...p, summary: e.target.value}))}
                  placeholder="Briefly describe your professional background..."
              />
          </div>

          {/* Experience */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-indigo-400">Work Experience</h2>
                  <button 
                    type="button" 
                    onClick={addExperience} 
                    className="text-sm bg-indigo-600/20 text-indigo-300 px-3 py-1 rounded hover:bg-indigo-600/30"
                  >
                    + Add Role
                  </button>
              </div>
              <div className="space-y-6">
                  {profile.experience.map((exp) => (
                      <div key={exp.id} className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 relative group">
                          <div className="absolute top-2 right-2 z-20">
                            <button 
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeExperience(exp.id);
                                }} 
                                className="p-2 text-slate-500 hover:text-red-400 bg-slate-900/50 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                                aria-label="Remove role"
                            >
                                <TrashIcon />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 pr-8">
                              <Input label="Role / Title" value={exp.role} onChange={v => updateExperience(exp.id, 'role', v)} />
                              <Input label="Company" value={exp.company} onChange={v => updateExperience(exp.id, 'company', v)} />
                              <DateSelector label="Start Date" value={exp.startDate} onChange={v => updateExperience(exp.id, 'startDate', v)} />
                              <DateSelector label="End Date" value={exp.endDate} onChange={v => updateExperience(exp.id, 'endDate', v)} hasPresentOption />
                          </div>
                          <DescriptionEditor 
                              label="Description / Achievements" 
                              value={exp.description} 
                              onChange={(v) => updateExperience(exp.id, 'description', v)} 
                              placeholder="• Spearheaded a team of 5...&#10;• Increased revenue by 20%..."
                          />
                      </div>
                  ))}
                  {profile.experience.length === 0 && <p className="text-slate-500 text-sm italic">No experience added yet.</p>}
              </div>
          </div>

           {/* Education */}
           <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-indigo-400">Education</h2>
                  <button 
                    type="button" 
                    onClick={addEducation} 
                    className="text-sm bg-indigo-600/20 text-indigo-300 px-3 py-1 rounded hover:bg-indigo-600/30"
                  >
                    + Add Education
                  </button>
              </div>
              <div className="space-y-4">
                  {profile.education.map((edu) => (
                      <div key={edu.id} className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 relative group">
                           <div className="absolute top-2 right-2 z-20">
                            <button 
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeEducation(edu.id);
                                }} 
                                className="p-2 text-slate-500 hover:text-red-400 bg-slate-900/50 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                                aria-label="Remove education"
                            >
                                <TrashIcon />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-8 mb-4">
                              <div className="md:col-span-2">
                                <Input label="School / Institution" value={edu.institution} onChange={v => updateEducation(edu.id, 'institution', v)} />
                              </div>
                              <Input label="Degree" value={edu.degree} onChange={v => updateEducation(edu.id, 'degree', v)} placeholder="e.g. Bachelor's, Master's" />
                              <Input label="Major / Field of Study" value={edu.major} onChange={v => updateEducation(edu.id, 'major', v)} placeholder="e.g. Computer Science" />
                              <DateSelector label="Start Date" value={edu.startDate} onChange={v => updateEducation(edu.id, 'startDate', v)} />
                              <DateSelector label="End Date" value={edu.endDate} onChange={v => updateEducation(edu.id, 'endDate', v)} hasPresentOption />
                          </div>
                          <DescriptionEditor 
                              label="Description / Activities (Optional)" 
                              value={edu.description} 
                              onChange={(v) => updateEducation(edu.id, 'description', v)} 
                              placeholder="• Graduated with Honors&#10;• President of CS Club"
                          />
                      </div>
                  ))}
                  {profile.education.length === 0 && <p className="text-slate-500 text-sm italic">No education added yet.</p>}
              </div>
          </div>

          {/* Projects */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-indigo-400">Projects</h2>
                  <button 
                    type="button" 
                    onClick={addProject} 
                    className="text-sm bg-indigo-600/20 text-indigo-300 px-3 py-1 rounded hover:bg-indigo-600/30"
                  >
                    + Add Project
                  </button>
              </div>
              <div className="space-y-6">
                  {profile.projects.map((proj) => (
                      <div key={proj.id} className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 relative group">
                           <div className="absolute top-2 right-2 z-20">
                            <button 
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeProject(proj.id);
                                }} 
                                className="p-2 text-slate-500 hover:text-red-400 bg-slate-900/50 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                                aria-label="Remove project"
                            >
                                <TrashIcon />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3 pr-8">
                              <Input label="Project Name" value={proj.name} onChange={v => updateProject(proj.id, 'name', v)} />
                              <Input label="Link (Optional)" value={proj.link || ''} onChange={v => updateProject(proj.id, 'link', v)} placeholder="https://..." />
                          </div>
                          <DescriptionEditor 
                              label="Description" 
                              value={proj.description} 
                              onChange={(v) => updateProject(proj.id, 'description', v)} 
                              placeholder="• Built a React app using Firebase&#10;• Implemented real-time chat features"
                          />
                      </div>
                  ))}
                  {profile.projects.length === 0 && <p className="text-slate-500 text-sm italic">No projects added yet.</p>}
              </div>
          </div>

          {/* Skills */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-xl font-semibold mb-4 text-indigo-400">Skills</h2>
              
              <div className="flex gap-3 mb-4">
                  <input 
                      type="text"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={handleSkillKeyDown}
                      placeholder="Type a skill and press Enter"
                      className="flex-grow bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  <button 
                      type="button"
                      onClick={handleAddSkill}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-colors"
                  >
                      Add
                  </button>
              </div>

              {profile.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                      {profile.skills.map((skill, index) => (
                          <span key={`${skill}-${index}`} className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-sm text-indigo-200 group">
                              {skill}
                              <button 
                                  type="button"
                                  onClick={() => handleRemoveSkill(skill)}
                                  className="text-indigo-400 hover:text-red-400 hover:bg-red-500/20 rounded-full p-0.5 transition-colors"
                                  aria-label={`Remove ${skill}`}
                              >
                                  <XIcon />
                              </button>
                          </span>
                      ))}
                  </div>
              ) : (
                  <p className="text-slate-500 text-sm italic">No skills added yet.</p>
              )}
          </div>

          {/* Certifications */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-indigo-400">Certifications & Licenses</h2>
                  <button 
                    type="button" 
                    onClick={addCertification} 
                    className="text-sm bg-indigo-600/20 text-indigo-300 px-3 py-1 rounded hover:bg-indigo-600/30"
                  >
                    + Add Certification
                  </button>
              </div>

              <div className="space-y-4">
                  {profile.certifications.map((cert) => (
                      <div key={cert.id} className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 relative group">
                          <div className="absolute top-2 right-2 z-20">
                            <button 
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeCertification(cert.id);
                                }} 
                                className="p-2 text-slate-500 hover:text-red-400 bg-slate-900/50 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                                aria-label="Remove certification"
                            >
                                <TrashIcon />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-8">
                              <div className="md:col-span-2">
                                  <Input label="Name" value={cert.name} onChange={v => updateCertification(cert.id, 'name', v)} placeholder="e.g. AWS Solutions Architect" />
                              </div>
                              <div className="md:col-span-2">
                                  <Input label="Issuing Organization" value={cert.issuer} onChange={v => updateCertification(cert.id, 'issuer', v)} placeholder="e.g. Amazon Web Services" />
                              </div>
                              <DateSelector label="Issue Date" value={cert.startDate} onChange={v => updateCertification(cert.id, 'startDate', v)} />
                              <DateSelector label="Expiration Date" value={cert.expirationDate || ''} onChange={v => updateCertification(cert.id, 'expirationDate', v)} />
                              
                              <Input label="Credential ID" value={cert.credentialId || ''} onChange={v => updateCertification(cert.id, 'credentialId', v)} placeholder="Optional" />
                              <Input label="Credential URL" value={cert.url || ''} onChange={v => updateCertification(cert.id, 'url', v)} placeholder="https://..." />
                          </div>
                      </div>
                  ))}
                   {profile.certifications.length === 0 && <p className="text-slate-500 text-sm italic">No certifications added yet.</p>}
              </div>
          </div>

      </div>
    </div>
  );
};

const DescriptionEditor: React.FC<{
    label: string;
    value: string | string[];
    onChange: (val: string) => void;
    placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => {
    // Check if looks like a list to set initial state
    const normalizedValue = Array.isArray(value) 
        ? value.map(v => v.trim().startsWith('•') || v.trim().startsWith('-') ? v : `• ${v}`).join('\n') 
        : (value || '');

    const looksLikeList = normalizedValue.trim().startsWith('•') || normalizedValue.trim().startsWith('-');
    const [isListMode, setIsListMode] = useState(looksLikeList);

    const handleModeToggle = () => {
        setIsListMode(!isListMode);
    };
    
    const getListItems = () => {
         if (!normalizedValue) return [];
         // Split by newline and remove existing bullets
         return normalizedValue.split('\n')
            .map(line => line.replace(/^[•\-\*]\s?/, '').trim()) 
    };
    
    const updateFromList = (items: string[]) => {
        const newValue = items.map(item => `• ${item}`).join('\n');
        onChange(newValue);
    };
    
    const handleItemChange = (index: number, newVal: string) => {
        const items = getListItems();
        if (index >= items.length) {
            items.push(newVal);
        } else {
            items[index] = newVal;
        }
        updateFromList(items);
    };

    const handleDeleteItem = (index: number) => {
         const items = getListItems();
         items.splice(index, 1);
         updateFromList(items);
    };

    const handleAddItem = () => {
         const items = getListItems();
         items.push('');
         updateFromList(items);
    };

    return (
        <div className="mt-2">
            <div className="flex justify-between items-center mb-2">
                 <label className="block text-xs text-slate-400">{label}</label>
                 <button 
                    type="button"
                    onClick={handleModeToggle}
                    className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
                 >
                    {isListMode ? <><TextIcon /> Switch to Text Editor</> : <><ListIcon /> Switch to List Editor</>}
                 </button>
            </div>
            
            {isListMode ? (
                <div className="space-y-2">
                    {getListItems().map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-start">
                            <span className="text-slate-500 mt-2">•</span>
                            <textarea
                                rows={1}
                                className="flex-grow bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none resize-none overflow-hidden"
                                style={{ minHeight: '38px' }} 
                                value={item}
                                onChange={(e) => {
                                    e.target.style.height = 'auto';
                                    e.target.style.height = e.target.scrollHeight + 'px';
                                    handleItemChange(idx, e.target.value);
                                }}
                                placeholder="Description point..."
                            />
                            <button
                                type="button"
                                onClick={() => handleDeleteItem(idx)}
                                className="p-2 text-slate-600 hover:text-red-400 transition-colors"
                            >
                                <XIcon />
                            </button>
                        </div>
                    ))}
                     <button
                        type="button"
                        onClick={handleAddItem}
                        className="text-sm flex items-center gap-2 text-slate-400 hover:text-slate-200 mt-2 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                     >
                         <PlusIcon /> Add Bullet Point
                     </button>
                </div>
            ) : (
                <textarea 
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 min-h-[80px] text-sm text-slate-300 focus:ring-1 focus:ring-indigo-500 outline-none"
                    value={normalizedValue}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder || "Describe your responsibilities and achievements..."}
                />
            )}
        </div>
    );
};

const DateSelector: React.FC<{
    label: string;
    value: string;
    onChange: (val: string) => void;
    hasPresentOption?: boolean;
}> = ({ label, value, onChange, hasPresentOption }) => {
    const isPresent = value === 'Present';
    
    const normalize = (val: string) => {
        if (!val || val === 'Present') return { m: '', y: '' };
        const parts = val.split(' ');
        let m = '', y = '';
        
        if (parts.length > 0) {
            // Try to match month (e.g. "September" -> "Sep")
            const p0 = parts[0];
            const match = MONTHS.find(mon => p0.toLowerCase().startsWith(mon.toLowerCase()));
            if (match) m = match;
            
            // Find year
            const yearPart = parts.find(p => /^\d{4}$/.test(p));
            if (yearPart) y = yearPart;
        }
        return { m, y };
    }

    const { m: selectedMonth, y: selectedYear } = normalize(value);

    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newMonth = e.target.value;
        if (newMonth && selectedYear) onChange(`${newMonth} ${selectedYear}`);
        else if (newMonth) onChange(newMonth);
        else if (selectedYear) onChange(selectedYear);
        else onChange('');
    };

    const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newYear = e.target.value;
        if (selectedMonth && newYear) onChange(`${selectedMonth} ${newYear}`);
        else if (newYear) onChange(newYear);
        else onChange('');
    };
    
    const togglePresent = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) onChange('Present');
        else onChange('');
    };

    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">{label}</label>
            <div className="flex gap-2">
                <div className="relative w-1/2">
                    <select 
                        value={selectedMonth} 
                        onChange={handleMonthChange}
                        disabled={isPresent}
                        className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-30 pr-8"
                    >
                        <option value="">Month</option>
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
                <div className="relative w-1/2">
                    <select 
                        value={selectedYear} 
                        onChange={handleYearChange}
                        disabled={isPresent}
                        className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-30 pr-8"
                    >
                        <option value="">Year</option>
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                     <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
            </div>
            {hasPresentOption && (
                <label className="flex items-center gap-2 mt-1 cursor-pointer">
                    <input type="checkbox" checked={isPresent} onChange={togglePresent} className="rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-xs text-slate-400">Currently study/work here</span>
                </label>
            )}
        </div>
    );
};

const Input: React.FC<{ label: string, value: string, onChange: (val: string) => void, disabled?: boolean, placeholder?: string }> = ({ label, value, onChange, disabled, placeholder }) => (
    <div>
        <label className="block text-xs text-slate-400 mb-1">{label}</label>
        <input 
            type="text" 
            value={value} 
            onChange={e => onChange(e.target.value)} 
            disabled={disabled}
            placeholder={placeholder}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50"
        />
    </div>
);

export default UserProfileView;
