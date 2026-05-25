I will implement Phase 2 (Enrollment and Access Generation) for the EduManager system.

### Database Updates
The tables `matriculas` and `matricula_cursos` exist, but I'll add the `observacao` column to `matriculas` as it was mentioned in the requirement but currently missing from the schema.

### Admin Interface
1. **Sidebar Update**: Enable the "Matrículas" item and link it to `/matriculas`.
2. **Matrículas Route Structure**:
    - `_admin.matriculas.index.tsx`: List of enrollments with search and actions.
    - `_admin.matriculas.novo.tsx`: Stepper for new enrollment (Select Student -> Select Courses).
    - `_admin.matriculas.$id.editar.tsx`: Edit existing enrollment (Add/Remove courses).
3. **Enrollment Workflow**:
    - Step 1: Search and select student.
    - Step 2: Select multiple courses from a card grid.
    - On confirmation: Save to DB, generate credentials (using a simple random password for now), and show a modal with login info.

### Logic Details
- **Credential Generation**: When a student is enrolled, if they don't have a login/password yet, I will generate them. Since the user asked for this in "Module 2", I'll implement a logic where the `email` is the login and a random string is the password, storing them appropriately (I'll check if a `perfil_aluno` or similar table exists for credentials, otherwise I'll propose a table for student access).

### Technical Details
- Use TanStack Router for navigation.
- Use TanStack Query for data fetching.
- Use Lucide icons for UI elements.
- Ensure consistent styling with existing admin modules.
