<!-- lyriks-skill:lyriks-build -->
## lyriks-build

Build or extend a Lyriks project end-to-end through the Lyriks MCP — declare the external scope, author and assess every section, build a runnable Experience prototype, verify local behavior, run the whole-project audit, and finish only when its deterministic gate passes. Use whenever the task is to create/populate a Lyriks project, design its screens, or wire its simulator via the MCP (tools prefixed mcp__lyriks__*).

Before authoring Lyriks project data through the Lyriks MCP tools, read `.agents/skills/lyriks-build/SKILL.md` in full and follow it. It is the authoritative procedure — do not improvise around it.
<!-- /lyriks-skill:lyriks-build -->

<!-- lyriks-skill:lyriks-design -->
## lyriks-design

Non-negotiable design discipline for authoring Lyriks Experience screens through the MCP — component-first composition, responsive-by-default layout, and a product-derived visual identity (every theme lever set from the product; never the default theme, never the reflex dark+green look). Load this before authoring builder.theme and before ANY build_screen / wire_element / patch_section on the experience builder, whether creating a new screen or updating an existing one. Invoked by lyriks-build at the scaffold and screen-building steps, and usable standalone when only touching design.

Before authoring Lyriks project data through the Lyriks MCP tools, read `.agents/skills/lyriks-design/SKILL.md` in full and follow it. It is the authoritative procedure — do not improvise around it.
<!-- /lyriks-skill:lyriks-design -->

<!-- lyriks-skill:lyriks-behavior -->
## lyriks-behavior

Author FULL unspaghettit behavior depth on Lyriks features via mcp__lyriks__apply_behavior_batch: surfaces, typed state, actions with mandatory rules, effects, executable scenarios, invariants, reachability goals. MANDATORY whenever features are created: a feature is NEVER left at 0% (name+description only) unless the user explicitly asks for shells, or names a target TRL ("stop at TRL 5"), which caps the authored depth per the TRL ladder in this skill. Invoked by lyriks-build at the features step; usable standalone to deepen an existing project.

Before authoring Lyriks project data through the Lyriks MCP tools, read `.agents/skills/lyriks-behavior/SKILL.md` in full and follow it. It is the authoritative procedure — do not improvise around it.
<!-- /lyriks-skill:lyriks-behavior -->

<!-- lyriks-skill:lyriks-retrospec -->
## lyriks-retrospec

Reverse-engineer an EXISTING product into its Lyriks spec (retro-spec), product-first: model what its users see and do, in their words; the codebase is evidence, never the subject. Triggers on 'ingest this codebase', 'retro spec', 'reverse engineer this app', 'spec the existing product', 'clone this app into Lyriks', 'adopt this product', 'start from a codebase'. Wraps lyriks-build with the product-language law, real-theme extraction, UI-walk screen inventory and behavior-complete data modeling, so the user barely needs to intervene.

Before authoring Lyriks project data through the Lyriks MCP tools, read `.agents/skills/lyriks-retrospec/SKILL.md` in full and follow it. It is the authoritative procedure — do not improvise around it.
<!-- /lyriks-skill:lyriks-retrospec -->

<!-- lyriks-skill:lyriks-delivery -->
## lyriks-delivery

Turn a Lyriks spec into delivery work and close the loop back: find what the spec declares that the code does not have yet, write tickets whose acceptance criteria ARE the modeled scenarios, and re-sync the implementation index once the code lands. Use whenever Lyriks meets a tracker or a delivery workflow (Jira, Linear, GitHub Issues, BMAD, Scrum): 'prepare the tickets', 'what is left to build', 'the PO enriched feature X', 'create the story for this feature', 'plan the sprint from the spec'. Pairs with lyriks-behavior (authoring the spec) and lyriks-retrospec (extracting it from existing code).

Before authoring Lyriks project data through the Lyriks MCP tools, read `.agents/skills/lyriks-delivery/SKILL.md` in full and follow it. It is the authoritative procedure — do not improvise around it.
<!-- /lyriks-skill:lyriks-delivery -->
## Product/spec synchronization

Keep the Studio Lyriks specification synchronized when changing product behavior or design. Update the relevant feature, rules and acceptance scenarios along with Experience changes; do not leave a new capability only in code or only in a visual mockup. The current Vector Rally code is the design authority. Report prototype limitations and global audit blockers separately from completed feature work.
