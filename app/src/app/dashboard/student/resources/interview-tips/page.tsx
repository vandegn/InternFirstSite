'use client';

import Link from 'next/link';

const tipBox: React.CSSProperties = {
  padding: '16px 20px',
  borderLeft: '4px solid var(--primary)',
  background: 'rgba(26, 45, 73, 0.04)',
  borderRadius: '0 8px 8px 0',
  marginBottom: '16px',
  fontSize: '0.9rem',
  color: 'var(--text-secondary)',
  lineHeight: 1.7,
};

const sectionStyle: React.CSSProperties = { marginBottom: '32px' };
const h3Style: React.CSSProperties = { fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px' };
const pStyle: React.CSSProperties = { color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.95rem', marginBottom: '12px' };
const listStyle: React.CSSProperties = { color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '0.95rem', paddingLeft: '20px', marginBottom: '12px' };

export default function InterviewTips() {
  return (
    <div className="dash-main" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <Link href="/dashboard/student/resources" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '24px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Back to Resources
      </Link>

      <div className="profile-card" style={{ padding: '36px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Interview Preparation Guide</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '36px' }}>Strategies and techniques to help you ace behavioral, technical, and case interviews.</p>

        <section style={sectionStyle}>
          <h3 style={h3Style}>Types of Interviews</h3>
          <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
            {[
              { type: 'Behavioral', desc: 'Focuses on past experiences and how you handled situations. Uses questions like "Tell me about a time when..."' },
              { type: 'Technical', desc: 'Tests your domain knowledge through coding challenges, case problems, or technical questions specific to the role.' },
              { type: 'Case', desc: 'Common in consulting and finance. You are given a business problem to analyze and solve in real time.' },
              { type: 'Conversational', desc: 'A more informal chat to assess culture fit. Still an evaluation — be professional and prepared.' },
            ].map((item) => (
              <div key={item.type} style={{ padding: '14px 18px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>{item.type}</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={sectionStyle}>
          <h3 style={h3Style}>The STAR Method</h3>
          <p style={pStyle}>STAR is a framework for answering behavioral interview questions with clear, structured stories:</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            {[
              { letter: 'S', label: 'Situation', desc: 'Set the scene. Briefly describe the context.' },
              { letter: 'T', label: 'Task', desc: 'Explain your specific responsibility or challenge.' },
              { letter: 'A', label: 'Action', desc: 'Describe the steps you took. Be specific.' },
              { letter: 'R', label: 'Result', desc: 'Share the outcome. Quantify if possible.' },
            ].map((item) => (
              <div key={item.letter} style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 700, margin: '0 auto 10px' }}>{item.letter}</div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>{item.label}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <div style={tipBox}>
            <strong>Example:</strong> &quot;Tell me about a time you worked on a team project with conflict.&quot;<br /><br />
            <strong>S:</strong> In my marketing class, our group of four had two members who disagreed on the campaign direction.<br />
            <strong>T:</strong> As team lead, I needed to align everyone and deliver by the deadline.<br />
            <strong>A:</strong> I scheduled a meeting where each person presented their approach, then facilitated a vote on the strongest elements of each. We merged both ideas into a hybrid strategy.<br />
            <strong>R:</strong> The team delivered the project on time and received the highest grade in the class. Both members said the final result was stronger than either original idea.
          </div>
        </section>

        <section style={sectionStyle}>
          <h3 style={h3Style}>Common Interview Questions</h3>
          <p style={pStyle}>Prepare responses for these frequently asked questions:</p>
          <ul style={listStyle}>
            <li><strong>&quot;Tell me about yourself.&quot;</strong> — Give a 60-second overview: who you are, what you study, what you are looking for, and why this role interests you.</li>
            <li><strong>&quot;Why are you interested in this position?&quot;</strong> — Connect your skills and interests to specific aspects of the role and company.</li>
            <li><strong>&quot;What is your greatest strength?&quot;</strong> — Choose a strength relevant to the role and back it up with a brief example.</li>
            <li><strong>&quot;Tell me about a challenge you overcame.&quot;</strong> — Use the STAR method. Focus on what you learned and how you grew.</li>
            <li><strong>&quot;Where do you see yourself in 5 years?&quot;</strong> — Show ambition while staying realistic. Connect your goals to the industry.</li>
            <li><strong>&quot;Do you have any questions for us?&quot;</strong> — Always say yes. Ask about team culture, growth opportunities, or what success looks like in the role.</li>
          </ul>
          <div style={tipBox}>
            <strong>Pro tip:</strong> Prepare 3-5 STAR stories that cover teamwork, leadership, problem-solving, and failure/learning. Most behavioral questions can be answered by adapting one of these stories.
          </div>
        </section>

        <section style={sectionStyle}>
          <h3 style={h3Style}>Day-of Checklist</h3>
          <ul style={listStyle}>
            <li>Research the company, their recent news, and the interviewer if possible</li>
            <li>Review the job description and prepare examples that match their requirements</li>
            <li>Dress one level above the company dress code (business casual for most internships)</li>
            <li>Arrive 10-15 minutes early (or log in to virtual calls 5 minutes early)</li>
            <li>Bring printed copies of your resume (2-3 copies for in-person interviews)</li>
            <li>Have a pen and notebook to take notes</li>
            <li>Prepare 2-3 thoughtful questions to ask the interviewer</li>
            <li>For virtual interviews: test your camera, microphone, and internet connection beforehand. Use a clean, well-lit background.</li>
          </ul>
        </section>

        <section style={{ marginBottom: 0 }}>
          <h3 style={h3Style}>Follow-Up Etiquette</h3>
          <p style={pStyle}>What you do after the interview matters just as much:</p>
          <ul style={listStyle}>
            <li><strong>Send a thank-you email within 24 hours</strong> — reference something specific from the conversation to make it personal</li>
            <li><strong>Keep it brief</strong> — 3-4 sentences: thank them, mention a highlight, reaffirm your interest</li>
            <li><strong>If you interviewed with multiple people</strong>, send a unique note to each person</li>
            <li><strong>If you do not hear back</strong> within the timeline they gave, follow up once after 1 week with a polite check-in</li>
            <li><strong>If you do not get the offer</strong>, respond graciously and ask for feedback. This leaves the door open for future opportunities.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
