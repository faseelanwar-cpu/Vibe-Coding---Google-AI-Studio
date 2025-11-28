
import { CandidateProfile } from '../types';

declare var jspdf: any;

export const generatePDF = async (profile: CandidateProfile): Promise<Blob> => {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    // LaTeX ModernCV Style Config
    const margin = 20; // 20mm uniform margin
    const pageWidth = 210;
    const pageHeight = 297;
    const contentWidth = pageWidth - (margin * 2);
    const lineHeight = 5; // Standard line height
    let y = margin;
    
    // Safe string helper
    const safeStr = (str: any): string => {
        if (str === null || str === undefined) return "";
        return String(str).trim(); 
    };

    // Typography Helper (Times New Roman for LaTeX look)
    const setFont = (type: 'header' | 'subHeader' | 'section' | 'body' | 'bold' | 'italic') => {
        doc.setTextColor(0, 0, 0); // Ensure Deep Black
        switch (type) {
            case 'header':
                doc.setFont('times', 'bold');
                doc.setFontSize(24); 
                break;
            case 'section':
                doc.setFont('times', 'bold');
                doc.setFontSize(12); 
                break;
            case 'subHeader': // Role
                doc.setFont('times', 'bold');
                doc.setFontSize(11);
                break;
            case 'bold': 
                doc.setFont('times', 'bold');
                doc.setFontSize(10);
                break;
            case 'italic': 
                doc.setFont('times', 'italic');
                doc.setFontSize(10);
                break;
            case 'body':
            default:
                doc.setFont('times', 'normal');
                doc.setFontSize(10);
                break;
        }
    };

    const checkPageBreak = (heightNeeded: number) => {
        // Add a buffer to prevent cutting off the last line
        if (y + heightNeeded > (pageHeight - margin)) { 
            doc.addPage();
            y = margin;
        }
    };

    // --- 1. HEADER ---
    setFont('header');
    const name = safeStr(profile.personalInfo.name).toUpperCase();
    doc.text(name, pageWidth / 2, y, { align: 'center' });
    y += 8;

    setFont('body');
    const contactParts = [
        profile.personalInfo.phone,
        profile.personalInfo.email,
        profile.personalInfo.location,
        profile.personalInfo.linkedin,
        profile.personalInfo.portfolio
    ].filter(Boolean).map(s => safeStr(s));
    
    if (contactParts.length > 0) {
        const contactLine = contactParts.join('  |  ');
        const lines = doc.splitTextToSize(contactLine, contentWidth);
        doc.text(lines, pageWidth / 2, y, { align: 'center' });
        y += (lines.length * lineHeight) + 4;
    }
    
    // Horizontal Rule
    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Helper for Section Titles
    const renderSectionTitle = (title: string) => {
        checkPageBreak(15);
        setFont('section');
        doc.text(title.toUpperCase(), margin, y);
        y += 2;
        doc.setLineWidth(0.1);
        doc.line(margin, y, pageWidth - margin, y); // Thin underline
        y += 6;
    };

    // --- 2. SUMMARY ---
    if (profile.summary) {
        renderSectionTitle("Professional Summary");
        setFont('body');
        const text = safeStr(profile.summary);
        const lines = doc.splitTextToSize(text, contentWidth);
        checkPageBreak(lines.length * lineHeight);
        // Using 'justify' with maxWidth aligns text nicely
        doc.text(lines, margin, y, { align: 'justify', maxWidth: contentWidth });
        y += (lines.length * lineHeight) + 6;
    }

    // --- Helper to Render Bullets ---
    const renderBulletList = (description: string | string[]) => {
        setFont('body');
        let bullets: string[] = [];

        if (Array.isArray(description)) {
            // Filter out empty strings/nulls and flatten
            bullets = description
                .map(safeStr)
                .filter(s => s.length > 0);
        } else {
            // Legacy string support
            const desc = safeStr(description);
            if (desc) {
                bullets = desc.split(/\n|•/).map(l => l.trim()).filter(l => l.length > 0 && l !== '-');
            }
        }

        bullets.forEach(bullet => {
            // Remove any existing bullet chars at start
            const cleanBullet = bullet.replace(/^[\-\*•]\s*/, '');
            if (!cleanBullet) return;

            // Calculate height
            const bulletLines = doc.splitTextToSize(cleanBullet, contentWidth - 5);
            checkPageBreak(bulletLines.length * lineHeight);
            
            // Draw bullet
            doc.text("•", margin, y);
            // Draw text indented by 5mm
            doc.text(bulletLines, margin + 5, y, { align: 'justify', maxWidth: contentWidth - 5 });
            
            y += (bulletLines.length * lineHeight); 
        });
    };

    // --- 3. EXPERIENCE ---
    if (profile.experience && profile.experience.length > 0) {
        renderSectionTitle("Experience");
        
        profile.experience.forEach(exp => {
            checkPageBreak(25); // Ensure header + 1 line fits
            
            // Line 1: Role (Left) ... Date (Right)
            setFont('subHeader');
            doc.text(safeStr(exp.role), margin, y);
            
            setFont('body'); 
            const dateStr = `${safeStr(exp.startDate)} – ${safeStr(exp.endDate)}`;
            doc.text(dateStr, pageWidth - margin, y, { align: 'right' });
            y += 5;

            // Line 2: Company (Italic)
            setFont('italic');
            doc.text(safeStr(exp.company), margin, y);
            y += 5;

            // Bullets
            if (exp.description) {
                 renderBulletList(exp.description);
            }
            
            y += 4; // Gap between jobs
        });
    }

    // --- 4. EDUCATION ---
    if (profile.education && profile.education.length > 0) {
        renderSectionTitle("Education");
        profile.education.forEach(edu => {
            checkPageBreak(15);
            
            setFont('subHeader');
            doc.text(safeStr(edu.institution), margin, y);
            
            const dateStr = `${safeStr(edu.startDate)} – ${safeStr(edu.endDate)}`;
            setFont('body');
            doc.text(dateStr, pageWidth - margin, y, { align: 'right' });
            y += 5;
            
            let degreeLine = safeStr(edu.degree);
            if (edu.major) degreeLine += `, ${safeStr(edu.major)}`;
            doc.text(degreeLine, margin, y);
            y += 6;
            
            if (edu.description) {
                 renderBulletList(edu.description);
                 y += 2;
            }
            y += 2;
        });
    }

    // --- 5. SKILLS ---
    if (profile.skills && profile.skills.length > 0) {
        renderSectionTitle("Skills");
        setFont('body');
        const skillStr = profile.skills.map(s => safeStr(s)).join(' • ');
        const lines = doc.splitTextToSize(skillStr, contentWidth);
        checkPageBreak(lines.length * lineHeight);
        doc.text(lines, margin, y);
        y += (lines.length * lineHeight) + 6;
    }

    // --- 6. PROJECTS ---
    if (profile.projects && profile.projects.length > 0) {
        renderSectionTitle("Projects");
        profile.projects.forEach(proj => {
            checkPageBreak(15);
            setFont('bold');
            doc.text(safeStr(proj.name), margin, y);
            
            if (proj.link) {
                doc.setFont('times', 'normal');
                const linkWidth = doc.getTextWidth(safeStr(proj.link));
                doc.text(safeStr(proj.link), pageWidth - margin - linkWidth, y);
            }
            y += 5;
            
            if (proj.description) {
                renderBulletList(proj.description);
                y += 3;
            }
        });
    }

    // --- 7. CERTIFICATIONS ---
    if (profile.certifications && profile.certifications.length > 0) {
        renderSectionTitle("Certifications");
        profile.certifications.forEach(cert => {
            checkPageBreak(10);
            setFont('body');
            let line = `• ${safeStr(cert.name)}`;
            if (cert.issuer) line += ` | ${safeStr(cert.issuer)}`;
            doc.text(line, margin, y);
            y += 5;
        });
    }

    // --- PAGE NUMBERS ---
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    return doc.output('blob');
};
