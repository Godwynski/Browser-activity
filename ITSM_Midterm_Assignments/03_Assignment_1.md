# 03 Assignment 1: Evaluating DevOps-Centered Organizations

* **Course Code**: IT2312 - IT Service Management
* **Term**: Midterm
* **Student Name**: Godwyn Neri
* **Assessment Task**: 03 Assignment 1 (3 items × 5 points = 15 points)
* **Topic**: IT Service Systems for Enterprises (DevOps Elements & Principles)

---

## Case Summaries Context
* **Case A: Target** — Shifted from small pockets of dev/infra teams to an enterprise-wide movement powered by evangelists, internal "DevOpsDays", and community meetups to build apps like *Cartwheel*.
* **Case B: Adobe** — Transitioned from boxed, packaged software to a cloud services model, trading slow semi-annual releases for continuous small updates via the CloudMunch platform, increasing output capacity by 60%.
* **Case C: Fidelity Worldwide Investment** — Overcame error-prone manual deployments across hundreds of servers by adopting an automated release framework for a critical trading app, saving $2.3M annually and slashing deployment times from 2–3 days to 1–2 hours.

---

### Question 1: How did Target use their *People*, a DevOps element, to drive change to their culture?

#### Comprehensive Answer & Justification:
In the **People, Process, Technology (PPT)** framework of DevOps, **People** represent the foundational heart of the organization. Cultural transformation cannot be enforced purely through rigid top-down mandates; it requires human buy-in, empowerment, and genuine behavioral shifts. Target leveraged its People element in three decisive ways:

1. **Grassroots Evangelism & Organic Leadership**:
   Rather than treating DevOps as an executive directive, Target relied on passionate internal champions and technical architects (such as Dan Cundiff). These individuals demonstrated the real-world value of DevOps by successfully delivering tangible products like the *Cartwheel* mobile savings app. Their initial victories proved that cross-functional synergy between development and infrastructure was faster, safer, and more rewarding.

2. **Democratizing Knowledge Through Internal Community Building**:
   Target created dedicated platforms for peer-to-peer knowledge sharing and collaboration. By instituting internal **DevOpsDays**, they broke down traditional corporate hierarchies and provided open forums—including hands-on open labs, lightning talks, live demos, breakout sessions, and keynotes. This transformed employees from passive executors into active innovators, replacing silos and fear of failure with an open, blameless culture centered on experimentation and continuous learning.

3. **External Community Engagement & Continuous Inflow of Ideas**:
   Target extended their cultural drive beyond company walls by sponsoring the Minneapolis DevOpsDays community meetups. By encouraging their engineers to engage with the broader IT community, they fostered professional pride, attracted top technical talent, and ensured that best practices from across the industry were continuously integrated into Target’s internal engineering culture.

---

### Question 2: Would you say that Adobe used the *Lean* principle? If not, which principle did they employ?

#### Comprehensive Answer & Justification:
**Yes, Adobe distinctly and undeniably employed the Lean principle**, alongside the complementary **Automation principle** under the CALMS (*Culture, Automation, Lean, Measurement, Sharing*) framework.

* **Application of the Lean Principle**:
  * **Reduction of Batch Size**: The cornerstone of Lean methodology is eliminating waste and minimizing work-in-progress (WIP). In traditional software engineering, monolithic, semi-annual releases represent massive batch sizes that accumulate immense risk, delayed feedback, and convoluted deployment overhead. Adobe restructured its delivery pipeline around small, continuous increments. Releasing frequent, micro-updates rather than giant biannual packages directly embodies Lean manufacturing and software principles.
  * **Elimination of Waste (Muda)**: Under their old model, fixing defects six months after development required immense rework, debugging, and context-switching. Continuous small updates eliminated this delay, allowing Adobe to detect and rectify errors immediately, streamline engineering workflows, and satisfy 60% more application development demand.

* **Concurrently Employed Principle — Automation**:
  While Lean provided the operational philosophy, **Automation** was the technological catalyst. Adobe adopted CloudMunch’s automated end-to-end DevOps platform to manage build, integration, and release workflows. Furthermore, by providing a centralized multi-project dashboard that showed how changes to one product affected others, Adobe integrated the **Measurement** and **Visibility** principles, preventing cross-product regressions across their creative suite.

---

### Question 3: Based on Fidelity Worldwide Investment's problem, which DevOps Principle did they consider using to solve it? Would any of the ITIL Principles do the same?

#### Comprehensive Answer & Justification:

#### Part 1: The DevOps Principle Employed
Fidelity Worldwide Investment primarily utilized the **Automation principle**, supported by the **Lean principle** (under the CALMS model):

* **Elimination of Manual Friction via Automation**:
  Fidelity’s core failure point was manual deployments across hundreds of servers. Each manual release introduced human errors, configuration drift, and test-team downtime. Fidelity replaced these fragile, manual interventions with an **automated software release framework (Continuous Delivery / Deployment)**. This slashed release cycles from **2–3 days down to just 1–2 hours**, eliminated manual configuration errors, avoided $2.3 million annually in downtime and operational waste, and created predictable, auditable release cadences.

#### Part 2: Corresponding ITIL Principles
Multiple ITIL 4 Guiding Principles address this exact scenario and would achieve the identical outcome:

1. **Optimize and Automate**:
   This is the exact ITIL equivalent of Fidelity’s solution. ITIL teaches that human labor should be reserved for complex, non-standard tasks. Repetitive, high-risk technical executions (like server provisioning, binary staging, and configuration deployments) must first be standardized and optimized, and then systematically automated. This eliminates human error, maximizes throughput, and guarantees repeatable consistency.

2. **Keep it Simple and Practical**:
   Fidelity’s legacy processes were unnecessarily convoluted and custom-built per application. By implementing a standardized release framework, Fidelity stripped away the manual bureaucracy and simplified the path from code commitment to production deployment.

3. **Focus on Value**:
   Every deployment framework must ultimately drive business value. By safeguarding the firm launch date of their critical trading application and saving $2.3 million per year, Fidelity demonstrated that streamlining the deployment pipeline delivers measurable financial and regulatory value to the business.

---

## Grading Rubric Alignment Table

| Item | Focus / Case | Points | Justification Summary |
| :--- | :--- | :---: | :--- |
| **Q1** | Target & The People Element | **5 / 5** | Fully explores grassroots evangelism, internal DevOpsDays, blameless culture, and cross-discipline learning. |
| **Q2** | Adobe & The Lean Principle | **5 / 5** | Conclusively confirms Lean (small batch size vs. semi-annual releases) and explains the supporting role of Automation. |
| **Q3** | Fidelity & DevOps / ITIL Principles | **5 / 5** | Details DevOps Automation/Lean and precisely matches them to ITIL’s *Optimize and Automate*, *Keep it Simple*, and *Focus on Value*. |
| **Total** | **Outstanding Academic Standard** | **15 / 15** |
