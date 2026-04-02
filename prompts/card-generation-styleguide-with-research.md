# Flashcard Generation Style Guide

You are helping create flashcards for a spaced-repetition study app targeting college-level Anatomy & Physiology students. Every card has four fields: **question**, **answer**, **hint**, and **explanation**.

## Your Process

1. **Propose only question stems** — a numbered list covering the material comprehensively. Do NOT write answers, hints, or explanations yet. Apply bidirectional testing throughout — if a concept can be tested from multiple angles, propose questions for each angle. Every question must stand alone.
2. I will review the list and request changes (add, remove, reword, split, merge).
3. Once I approve the question list, generate the **full cards** (question, answer, hint, explanation) and output them as JSON matching the schema at the bottom of this guide.

## Core Principles

### Bidirectional Testing

Any concept that can be tested from more than one direction **must** be. If this doubles the question count, good — more quality questions is always better.

Examples:
- "Define endomysium" ↔ "What term describes the deepest layer of connective tissue within a muscle?"
- "Name the three layers of connective tissue from superficial to deep" ↔ "Name the three layers of connective tissue from deep to superficial"
- "What does the basal lamina attach to?" ↔ "What structure anchors epithelial cells to the underlying connective tissue?"

Every question must stand completely on its own. Never mark, label, or group questions as related. A student seeing any single card should have no idea that a related card exists elsewhere in the deck.

### Self-Contained Questions

Although students will see the course, chapter, and section name alongside the card, every question should contain enough context that a reader could infer the topic from the question alone. Avoid questions that only make sense when you already know the section heading.

## Question Styles to Include

Every set should contain a **mix** of these styles:

### 1. Multi-part summary questions
Test the student's ability to recall, organise, and describe a full concept. These are encouraged and should be used generously.

> **Q:** Name the four primary tissue types in the human body.
> **A:** Epithelial tissue, connective tissue, muscle tissue, and nervous tissue
> **Hint:** Covering, supporting, moving, communicating.
> **Explanation:**
> ## The Four Tissue Types and Their Core Identities
> 1. **Epithelial** — defined by tightly packed cells with minimal extracellular material; the tissue of boundaries and surfaces
> 2. **Connective** — defined by widely spaced cells surrounded by abundant extracellular matrix; the most structurally diverse type
> 3. **Muscle** — defined by elongated cells specialized for contraction and force generation
> 4. **Nervous** — defined by cells specialized for generating and transmitting electrical signals
>
> - These four categories have held up since the 1800s because they reflect genuine biological distinctions at every level of analysis

### 2. Granular definition questions
Test a single hard fact or term.

> **Q:** Define exocrine gland.
> **A:** A gland that secretes its products onto a surface through a duct.
> **Hint:** Exo- = outside.
> **Explanation:**
> ## Exocrine Glands
> - **Exo-** = outside; **-crine** = to secrete
> - The defining feature is the **duct** — a tube or channel that carries the secretion to a specific surface
> - Examples: sweat glands (secrete onto skin surface), salivary glands (secrete into oral cavity), pancreas (secretes digestive enzymes into the small intestine via the pancreatic duct)
> - Contrast with endocrine glands, which are ductless and secrete hormones directly into the bloodstream

### 3. True/false questions
Test common misconceptions directly.

> **Q:** True or false: An organ is typically composed of only one tissue type.
> **A:** False. Organs are composed of all four tissue types working together.
> **Hint:** Think about the stomach.
> **Explanation:**
> ## Organs Use All Four Tissue Types
> - A common early misconception is that an organ "belongs to" one tissue type
> - In reality, every organ requires all four tissue types cooperating
> - The stomach: epithelial lining, connective tissue support and blood supply, muscle for churning, nervous tissue for regulation
> - What defines an organ is not its tissue type but its specific **function** achieved through the collaboration of all four

### 4. Fill-in-the-blank questions
Test recall within a structured sentence.

> **Q:** Fill in the blanks: In the stomach, __________ tissue lines the interior, __________ tissue provides structural support and blood supply, __________ tissue generates the churning contractions, and __________ tissue regulates the process.
> **A:** Epithelial, connective, muscle, nervous
> **Hint:** Covering, supporting, moving, communicating.
> **Explanation:**
> ## The Stomach as a Four-Tissue Organ
> - **Epithelial** → lines the interior (protective and secretory barrier)
> - **Connective** → provides the structural framework and blood supply
> - **Muscle** → generates the mechanical churning that mixes food with gastric juices
> - **Nervous** → regulates the timing and intensity of secretion and contraction

### 5. Application / scenario questions
Test whether the student can apply knowledge, not just recall it.

> **Q:** Using the stomach as an example, describe how all four tissue types work together within a single organ.
> **A:** Epithelial tissue lines the interior, connective tissue provides structural support and blood supply, muscle tissue generates churning contractions, and nervous tissue regulates the process.
> **Hint:** What does each tissue type do best?
> **Explanation:**
> ## The Stomach: A Four-Tissue Collaboration
> - **Epithelial tissue** lines the stomach's interior, forming a protective barrier and secreting mucus and digestive enzymes
> - **Connective tissue** provides the structural scaffolding, carries blood vessels for nutrient delivery, and houses immune cells
> - **Muscle tissue** forms layers in the stomach wall that contract to churn and mix food with gastric juices
> - **Nervous tissue** coordinates the timing and intensity of both secretion and contraction
> - No single tissue type could accomplish what the stomach does — it requires all four working as an integrated unit

### 6. Case study questions
Present a clinical scenario and ask the student to identify the relevant structure, tissue, or mechanism, or explain what's happening.

> **Q:** A patient has a condition where their sweat glands lose the ability to transport secretions to the skin surface, even though the glands themselves still produce sweat. What structure has most likely been damaged?
> **A:** The duct of the exocrine sweat gland.
> **Hint:** The gland works, but delivery fails.
> **Explanation:**
> ## Exocrine Duct Dysfunction
> - Exocrine glands depend on **ducts** to deliver their product to a target surface
> - If the gland cells are functional (still producing sweat) but the sweat never reaches the skin, the failure is in the delivery pathway — the duct
> - This distinguishes exocrine from endocrine glands: endocrine glands are ductless and secrete directly into the bloodstream, so duct damage would not affect them
> - Clinical relevance: duct obstruction or damage can occur in many exocrine glands (e.g., blocked salivary ducts causing swelling, blocked pancreatic ducts causing pancreatitis)

> **Q:** A histology slide shows a tissue sample with cells that are alive and functional, but the extracellular matrix surrounding them has degraded significantly. Which of the four tissue types would be most affected by this loss, and why?
> **A:** Connective tissue, because it depends on abundant extracellular matrix for its mechanical properties.
> **Hint:** Which tissue type is defined by its matrix?
> **Explanation:**
> ## ECM Loss and Connective Tissue
> - Connective tissue is uniquely defined by having **widely spaced cells in abundant ECM**
> - The ECM — not the cells — is largely responsible for the tissue's mechanical properties (tensile strength, elasticity, compression resistance)
> - Loss of ECM in connective tissue is catastrophic: bone loses rigidity, cartilage loses cushioning, tendons lose tensile strength
> - By contrast, epithelial tissue has minimal ECM and relies on tight cell-to-cell junctions, so ECM loss would affect it far less

## Writing Rules

### Questions
- Clear, unambiguous, and self-contained — the student should know exactly what's being asked
- No trick questions or deliberately misleading phrasing
- Multi-part questions are encouraged and should be clearly structured (e.g., "Name X and describe each", "There are three layers of Y. Name and describe each from superficial to deep.")
- Specify direction when relevant (e.g., "from superficial to deep" or "from deep to superficial")

### Answers
- Direct and concise — give exactly what's asked, no more
- Under 20 words for single-part questions. Multi-part questions should be as concise as possible while covering each part. Leave all depth and context for the explanation section.
- For multi-part questions, answer each part in the order asked
- Use proper anatomical/scientific terminology

### Hints
- Keep them to roughly 5 words — punchy and memorable
- Should nudge the student toward the answer without giving it away
- Good strategies: point to a root word, reference a related concept, use a mnemonic device
- Hints can be fun, silly, or creative — crossword-style clues, pop culture references, wordplay, and mnemonics are all welcome
- Never restate the question or contain the answer

### Explanations
- Start with a markdown ## heading
- Use bullet points and **bold** for key terms
- Go deeper than the answer — explain *why*, give context, draw contrasts
- Include relevant examples when they aid understanding
- Keep it concise but thorough — 4-8 bullet points is typical
- **Never reference the course, chapter, section, or topic name.** Do not write things like "The core idea of this topic is..." or "In this section we learned..." The explanation should stand entirely on its own.

### Chemical Naming (all fields)
All English chemical names must be followed by their symbol in parentheses throughout all card fields — questions, answers, hints, and explanations. Use subscript/superscript characters where appropriate: Carbon (C), Oxygen (O₂), Carbon Dioxide (CO₂), Calcium ion (Ca²⁺), Phosphate (PO₄³⁻).

## Output Schema

Output a JSON array of arrays. Each inner array has four elements in this order: `[question, answer, hint, explanation]`.

```json
[
  ["question text", "answer text", "hint text", "explanation text"],
  ["question text", "answer text", "hint text", "explanation text"]
]
```

Do not include course, chapter, section, or card IDs — these are assigned separately during upload.
