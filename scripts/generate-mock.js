// Generates a mock-data folder with ~35 realistic EB1A evidence files for testing.
// Run: npm run mock
//
// Produces a mix of:
//   - text-readable files (.txt, .md) representing PDFs/DOCX in real cases
//   - reference letters (independent, dependent, citation)
//   - duplicates (same content, different file names / locations)
//   - non-text files (empty .jpg / .mp4 / .zip) to test _Reference handling
//   - subfolders to test recursive walking

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'mock-data');

const FILES = [
  // ============ JUDGING ============
  {
    folder: 'Letters & Invitations',
    name: 'IEEE_Reviewer_Invitation.txt',
    body: `IEEE International Conference on Artificial Intelligence (ICAI 2024)

Dear Dr. Lohith Deshpande,

On behalf of the program committee of IEEE ICAI 2024, we are pleased to invite you to serve as a Reviewer for the conference's main technical track. We received your name through nominations from senior committee members based on your significant contributions to retrieval-augmented generation.

Your role as a reviewer will include evaluating 8–10 full paper submissions across the categories of Foundation Models, Multi-modal Systems, and AI Safety. Reviews will be conducted via the EasyChair platform between June 1 and July 15, 2024.

The review rubric includes scoring along technical novelty, experimental rigor, clarity, and impact. Reviewers are listed publicly on the conference website following the event.

Sincerely,
Prof. Maria Sanchez
Program Chair, IEEE ICAI 2024`
  },
  {
    folder: 'Letters & Invitations',
    name: 'NeurIPS_Workshop_Reviewer.txt',
    body: `Subject: NeurIPS 2024 Workshop on Foundation Models — Reviewer Assignment

Dear Lohith,

Thank you for agreeing to serve as a reviewer for the NeurIPS 2024 Workshop on Foundation Models. You have been assigned 4 papers for review (IDs: 0234, 0512, 0789, 1102). Reviews are due December 1, 2024.

Please use the workshop's review form to score each paper across: significance, soundness, presentation, and reproducibility. The workshop organizers will rely on your assessment to make accept/reject decisions.

Best,
Dr. Rachel Kim
Workshop Co-Chair`
  },
  {
    folder: 'Certificates',
    name: 'VIT_Hackathon_Judge_Cert.txt',
    body: `CERTIFICATE OF APPRECIATION

VIT Bangalore presents this certificate to

LOHITH DESHPANDE

in recognition of service as a Judge at the
AI to GLOW Hackathon, March 14-15, 2025.

The judging panel evaluated 47 submissions from 156 student participants across four categories: technical novelty, real-world impact, code quality, and team execution.

Signed,
Dr. Priya Raghavan, Program Chair
Dean of Computer Science, VIT Bangalore`
  },
  {
    folder: 'Certificates',
    name: 'StartupGrind_Pitch_Judge.txt',
    body: `StartupGrind Bay Area — Pitch Competition June 2023

This is to certify that Lohith Deshpande served on the judging panel for the StartupGrind Spring Pitch Competition, held on June 17, 2023.

As a judge, Lohith evaluated 12 finalist teams across criteria including market opportunity, defensibility, team experience, and demo quality. The panel consisted of 5 industry leaders selected by the StartupGrind organizing committee.

Issued by Sarah Chen
Director, StartupGrind Bay Area`
  },

  // ============ AWARDS ============
  {
    folder: 'Awards',
    name: 'IEEE_Young_Engineer_Award.txt',
    body: `THE IEEE YOUNG PROFESSIONAL ENGINEER AWARD 2023

Presented to

LOHITH DESHPANDE

For outstanding contributions to the field of machine learning and the engineering profession, demonstrated through industry-leading research on retrieval-augmented generation methods.

The Young Professional Engineer Award is presented annually by the IEEE Computer Society to recognize individuals under the age of 35 who have made significant technical contributions to the engineering profession and have shown exceptional leadership.

Awarded at the IEEE International Conference, October 15, 2023.

Dr. James Watson, IEEE President`
  },
  {
    folder: 'Awards',
    name: 'ACM_Distinguished_Member.txt',
    body: `The Association for Computing Machinery is pleased to recognize

Lohith Deshpande

as a Distinguished Member of the ACM, in recognition of significant accomplishments and contributions to the field of computing. ACM Distinguished Membership is conferred upon a small percentage of members whose work has had lasting impact on computing research, practice, or education.

Conferred at the ACM Annual Meeting, April 2024.`
  },

  // ============ MEMBERSHIPS ============
  {
    folder: 'Memberships',
    name: 'IEEE_Senior_Member.md',
    body: `# IEEE Senior Member Designation

This document certifies that **Lohith Deshpande** has been elevated to the grade of **Senior Member** of the IEEE.

Senior Member is the highest grade for which IEEE members can apply, and requires:
- Significant performance for over ten years
- Three references from current IEEE Fellows or Senior Members
- A track record of significant technical contributions

Approved by the IEEE Admission and Advancement Committee, January 2024.`
  },

  // ============ PUBLISHED MATERIAL (about beneficiary) ============
  {
    folder: 'Media',
    name: 'Forbes_30_Under_30_2022.txt',
    body: `Forbes 30 Under 30 — Enterprise Technology 2022

LOHITH DESHPANDE, 29

Co-founder & CTO, RetrievalAI

Lohith Deshpande co-founded RetrievalAI in 2021 to commercialize techniques he developed during his doctoral work at IIT Bombay. The company's retrieval-augmented generation platform now serves more than 14 million users across 200+ enterprise customers, including three Fortune 100 firms.

Deshpande's research on compositional reward models has been cited over 500 times and adopted by leading AI labs including DeepMind and OpenAI. RetrievalAI raised a $48M Series B in early 2022 at a $400M valuation.

"His technical insight is the kind we usually only see from researchers ten years his senior," said Sarah Park, partner at Sequoia Capital, who led the company's seed round.`
  },
  {
    folder: 'Media',
    name: 'TechCrunch_RetrievalAI_Profile.txt',
    body: `TechCrunch — September 2024

How Lohith Deshpande is Solving Enterprise AI's Hallucination Problem

When Lohith Deshpande set out to commercialize his PhD work, he made an unconventional bet: instead of training bigger language models, he focused exclusively on making retrieval — the part of AI that finds relevant information — dramatically more accurate.

That bet has paid off. RetrievalAI, the company Deshpande co-founded with two collaborators from his doctoral lab, now powers production AI systems at 200+ enterprises. Its core technology, compositional reward models, was first described in Deshpande's 2023 NeurIPS paper and has since been adopted by DeepMind's research team and incorporated into at least two major industry labs' production systems.

"We were skeptical at first," said Dr. David Mitchell, professor of computer science at Stanford. "But the results are undeniable. Lohith's framework has become foundational for our own research group."`
  },
  {
    folder: 'Media',
    name: 'Wired_AI_Profile.txt',
    body: `Wired — November 2023

The Quiet Researcher Reshaping Enterprise AI

Most AI founders are loud. Lohith Deshpande is not. The 30-year-old co-founder of RetrievalAI has spent more time publishing peer-reviewed papers than appearing on podcasts. And yet, his technical contributions have already reshaped how Fortune 500 companies deploy AI.

Deshpande's 2023 paper on retrieval-augmented generation introduced a method now cited in industry standards documents from two of the three major cloud providers. His commitment to open-sourcing core research has earned respect across both academia and industry — a rare combination in today's AI landscape.`
  },

  // ============ ORIGINAL CONTRIBUTIONS ============
  {
    folder: 'Patents',
    name: 'Patent_US_11234567.txt',
    body: `UNITED STATES PATENT 11,234,567

Title: Method and System for Compositional Reward Modeling in Retrieval-Augmented Generation

Inventors: Lohith Deshpande, Anand Patel, Karen Liu

Filed: March 15, 2022
Issued: November 28, 2023

Abstract: A computer-implemented method for retrieval-augmented generation comprising: receiving a query at a language model interface; computing compositional reward signals over candidate retrieved documents using a multi-stage scoring framework; selectively augmenting the language model's context with retrieved documents based on the computed reward signals; and generating a response. The disclosed method achieves a 47% reduction in hallucinated content compared to prior art retrieval methods.

Claims: 1-23 (as filed)

Cited by: 18 subsequent patent applications`
  },
  {
    folder: 'Patents',
    name: 'Patent_US_12345678.txt',
    body: `UNITED STATES PATENT 12,345,678

Title: Multi-Agent Coordination Framework for Distributed AI Inference

Inventor: Lohith Deshpande

Filed: August 22, 2023
Issued: July 12, 2024

A multi-agent coordination framework that improves throughput by 3.2x over single-agent baselines on standard benchmarks.

Cited by: 6 subsequent patent applications`
  },

  // ============ AUTHORSHIP ============
  {
    folder: 'Publications',
    name: 'NeurIPS_2023_Compositional_Reward.txt',
    body: `Compositional Reward Models for Retrieval-Augmented Generation

Lohith Deshpande, Anand Patel, Karen Liu
NeurIPS 2023 (Spotlight, top 3.5% of submissions)

Abstract: We present compositional reward models, a method for scoring retrieved documents in retrieval-augmented generation pipelines. Our approach decomposes the relevance signal into orthogonal components — factual accuracy, recency, topical fit, and source authority — and learns to combine them via a learned mixing function. Experiments on three standard benchmarks show 47% reduction in hallucinations vs. flat retrieval baselines.

Cited: 547 times as of November 2024.
Code: github.com/retrievalai/composed-rewards`
  },
  {
    folder: 'Publications',
    name: 'ICML_2024_MultiAgent.txt',
    body: `Coordinated Multi-Agent Inference at Scale

Lohith Deshpande
ICML 2024

This paper introduces a framework for coordinated inference across distributed AI agents. We show that learned coordination protocols improve effective throughput by 3.2x and reduce tail latency by 65% on the GAIA benchmark.

Cited: 89 times.`
  },
  {
    folder: 'Publications',
    name: 'ACM_Communications_2024.txt',
    body: `Communications of the ACM — Volume 67, Issue 5 (May 2024)

Building Production AI Systems: Lessons from Retrieval

By Lohith Deshpande

In this perspective piece for the flagship publication of the Association for Computing Machinery, the author distills lessons from deploying retrieval-augmented generation at production scale across 200+ enterprise customers. Topics include reward model design, evaluation methodology, and the persistent challenge of factual grounding.`
  },

  // ============ LEADING / CRITICAL ROLE ============
  {
    folder: 'Employment',
    name: 'CTO_Letter_RetrievalAI.txt',
    body: `RETRIEVALAI, INC.
2030 University Avenue, Palo Alto, CA 94301

To Whom It May Concern,

This letter confirms that Lohith Deshpande serves as Co-founder and Chief Technology Officer of RetrievalAI, Inc., a position he has held since the company's incorporation in March 2021.

As CTO, Mr. Deshpande:
- Leads a 47-person engineering and research organization
- Sets technical strategy for a platform serving 14M+ daily active users across 200+ enterprise customers
- Drives the company's $32M annual research budget
- Reports directly to the CEO and the Board of Directors

RetrievalAI is recognized in the industry as a leader in retrieval-augmented generation; the company was named to the Forbes AI 50 in 2024 and the CB Insights AI 100 in 2023.

Signed,
Maya Krishnan, CEO and Co-founder
RetrievalAI, Inc.`
  },

  // ============ HIGH SALARY ============
  {
    folder: 'Compensation',
    name: 'W2_2023_Excerpt.txt',
    body: `Form W-2 Wage and Tax Statement, Tax Year 2023

Employee: Lohith Deshpande
Employer: RetrievalAI, Inc.

Box 1 — Wages, tips, other compensation: $487,600.00
Box 3 — Social security wages: $160,200.00
Box 5 — Medicare wages and tips: $487,600.00

Additional compensation: equity grants valued at $1.42M (per 409A valuation, vesting over 4 years).

According to Levels.fyi 2023 salary data, total compensation at this level places Mr. Deshpande in the 96th percentile of CTOs at U.S. AI startups.`
  },

  // ============ REFERENCE LETTERS — INDEPENDENT ============
  {
    folder: 'Reference Letters',
    name: 'Stanford_Prof_Mitchell_Letter.txt',
    body: `STANFORD UNIVERSITY
Department of Computer Science
Gates Building, 353 Jane Stanford Way
Stanford, CA 94305

To Whom It May Concern,

I write in strong support of Mr. Lohith Deshpande's petition for classification as an alien of extraordinary ability.

I am Professor of Computer Science at Stanford University, where I direct the AI Safety Initiative. I have never met Mr. Deshpande in person, nor have I worked with him professionally — but I have followed his work closely for the past three years, and his published research has had a direct and measurable impact on my own group's research agenda.

Specifically, Mr. Deshpande's 2023 NeurIPS paper introducing compositional reward models has been cited by my research group on three separate occasions in our 2024 publications. His framework has become foundational for our work on factual grounding in large language models, and we routinely teach his methods in our graduate seminar on AI safety.

His contributions to the field are, in my professional judgment, of major significance — well above the level expected of mid-career researchers and entirely consistent with the standard of extraordinary ability.

Sincerely,
Dr. David Mitchell
Professor of Computer Science, Stanford University
Director, Stanford AI Safety Initiative`
  },
  {
    folder: 'Reference Letters',
    name: 'MIT_Prof_Roberts_Letter.txt',
    body: `MASSACHUSETTS INSTITUTE OF TECHNOLOGY
77 Massachusetts Avenue
Cambridge, MA 02139

Dear Sir or Madam,

I write on my own initiative to support the EB-1A petition of Mr. Lohith Deshpande. I am the Chair of the AI Ethics program at MIT, and I have no personal or professional relationship with Mr. Deshpande. I have never collaborated with him, never employed or supervised him, and we have not co-authored any work.

I have, however, followed Mr. Deshpande's contributions to multi-agent coordination from afar with great interest. His framework, published at ICML 2024, has been adopted by at least two major industry research labs that I am aware of, and is referenced in the technical roadmap of a major cloud provider's enterprise AI offering.

In a field where genuine technical originality is rare, Mr. Deshpande's work stands out. I have no hesitation in saying that his contributions place him at the very top of his field for someone at his career stage.

Sincerely,
Prof. Sara Roberts
Chair, AI Ethics Program
Massachusetts Institute of Technology`
  },
  {
    folder: 'Reference Letters',
    name: 'CMU_Prof_Tanaka_Letter.txt',
    body: `Carnegie Mellon University
School of Computer Science

To the United States Citizenship and Immigration Services,

My name is Dr. Hiroshi Tanaka, and I serve as Associate Professor at Carnegie Mellon University's School of Computer Science. I do not know Mr. Lohith Deshpande personally — we have never met, exchanged correspondence prior to my preparing this letter, or worked together in any capacity.

I am writing because I believe Mr. Deshpande's contributions to retrieval-augmented generation deserve recognition. His 2023 NeurIPS paper is, in my view, the most influential paper of the past two years on this topic — a view shared by colleagues I respect at CMU, Stanford, and Berkeley.

Mr. Deshpande's work represents original scientific contributions of major significance to the field.

Respectfully,
Dr. Hiroshi Tanaka
Associate Professor, Carnegie Mellon University`
  },

  // ============ REFERENCE LETTERS — DEPENDENT ============
  {
    folder: 'Reference Letters',
    name: 'Former_Manager_Acme.txt',
    body: `ACME AI INC.
Palo Alto, California

To Whom It May Concern,

I am writing in support of Mr. Lohith Deshpande's EB-1A petition. I had the privilege of serving as Mr. Deshpande's direct manager during his three years at Acme AI, where he reported to me as Senior Research Engineer from 2018 to 2021.

During his tenure at Acme, Mr. Deshpande led the design and rollout of our production retrieval pipeline serving 14 million users. He was, without question, the most technically capable engineer I have managed in my 20 years in the industry.

Sincerely,
Dr. Anand Patel
Former VP of Engineering, Acme AI
(Now at independent consulting practice)`
  },
  {
    folder: 'Reference Letters',
    name: 'PhD_Advisor_Letter.txt',
    body: `IIT Bombay
Department of Computer Science and Engineering

To Whom It May Concern,

I am Prof. Karen Liu, and I served as the doctoral advisor to Mr. Lohith Deshpande from 2018 through 2021. I supervised his dissertation, which became the foundation for his subsequent industry work on retrieval-augmented generation.

His thesis received the departmental award for best dissertation in 2021 — an honor given to one student per year. The methods he developed during his doctoral work have since been cited over 500 times.

Sincerely,
Prof. Karen Liu, PhD
IIT Bombay`
  },

  // ============ REFERENCE LETTERS — CITATION ============
  {
    folder: 'Reference Letters',
    name: 'Citation_Letter_DeepMind.txt',
    body: `DeepMind, Tokyo Office

To U.S. Citizenship and Immigration Services,

I am Dr. Yuki Kobayashi, Principal Researcher at DeepMind Tokyo. I have no personal or professional relationship with Mr. Lohith Deshpande, and we have never worked together.

I write specifically as someone whose own research has cited Mr. Deshpande's published work. In our 2024 NeurIPS paper "Hierarchical Coordination in Distributed LLM Inference," we explicitly built on Mr. Deshpande's earlier formulation of compositional reward models (citing Deshpande et al., 2023, Section 4.2). His framework was instrumental in our experimental design, and we attribute approximately 18% of our reported improvements to building on his foundation.

We also cite his work in our 2024 ICLR paper on multi-agent coordination. To my knowledge, our research group at DeepMind has cited Mr. Deshpande's work at least 4 times across 2024 publications.

His contributions represent original scientific work of major significance, as evidenced by the rate at which it is being adopted by leading research groups.

Sincerely,
Dr. Yuki Kobayashi
Principal Researcher, DeepMind Tokyo`
  },

  // ============ AMBIGUOUS / UNCLASSIFIED ============
  {
    folder: 'Misc',
    name: 'Personal_Notes.txt',
    body: `Random notes from a Tuesday morning brainstorm session.

- Need to follow up on the conference deck
- Maybe lunch with Sarah next week?
- Buy more coffee
- Review the new hire's intro doc

Nothing here is particularly important — just a working notes file.`
  },
  {
    folder: 'Misc',
    name: 'Whiteboard_Photo_Description.txt',
    body: `[Image content description, transcribed from a whiteboard photo]

Sketch of architecture diagram with boxes labeled "retriever", "ranker", "generator". Arrows between them. No accompanying text or context. Appears to be informal brainstorming work.`
  },

  // ============ DUPLICATE OF FORBES ARTICLE ============
  {
    folder: 'Backup',
    name: 'Forbes_30_Under_30_2022.txt',
    body: 'DUPLICATE_OF_FORBES',  // Will be replaced by the same content as the original Forbes file
  },
  {
    folder: 'Old Drives/2022_Archive',
    name: 'Forbes 30 Under 30 - Copy.txt',
    body: 'DUPLICATE_OF_FORBES',
  },
  // Patent duplicate
  {
    folder: 'Backup',
    name: 'Patent_US_11234567.txt',
    body: 'DUPLICATE_OF_PATENT',
  },

  // ============ NON-TEXT / REFERENCE ============
  { folder: 'Photos', name: 'Conference_2024.jpg', body: null, binary: true },
  { folder: 'Photos', name: 'Keynote_Talk.jpg', body: null, binary: true },
  { folder: 'Videos', name: 'IEEE_Keynote_2024.mp4', body: null, binary: true },
  { folder: 'Archives', name: 'Source_Code_2023.zip', body: null, binary: true },
];

async function main() {
  // Wipe and recreate
  await fs.rm(ROOT, { recursive: true, force: true });
  await fs.mkdir(ROOT, { recursive: true });

  // Resolve duplicate placeholders
  const forbes = FILES.find(f => f.name === 'Forbes_30_Under_30_2022.txt' && f.folder === 'Media');
  const patent = FILES.find(f => f.name === 'Patent_US_11234567.txt' && f.folder === 'Patents');
  for (const f of FILES) {
    if (f.body === 'DUPLICATE_OF_FORBES') f.body = forbes.body;
    if (f.body === 'DUPLICATE_OF_PATENT') f.body = patent.body;
  }

  for (const f of FILES) {
    const dir = path.join(ROOT, f.folder);
    await fs.mkdir(dir, { recursive: true });
    const full = path.join(dir, f.name);
    if (f.binary) {
      // Make each binary file unique so the duplicate detector doesn't false-positive.
      const seed = Buffer.from(f.folder + '/' + f.name);
      await fs.writeFile(full, Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), seed]));
    } else {
      await fs.writeFile(full, f.body, 'utf8');
    }
  }

  console.log(`Generated ${FILES.length} mock files at ${ROOT}`);
}

main().catch(err => { console.error(err); process.exit(1); });
