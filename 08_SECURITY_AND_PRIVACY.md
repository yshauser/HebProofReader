# Security and Privacy

## 1. Processing policy

MVP 1 proofreading runs locally in the browser. No document content is sent to an external service.

Any future backend or AI integration must be introduced as an explicit architectural change with a documented privacy policy.

## 2. Uploaded files

- Treat all uploads as untrusted.
- Accept only explicitly supported extensions and MIME types.
- Verify content signatures where practical; do not trust the filename alone.
- Set a configurable size limit.
- Reject password-protected or unsupported documents with a clear message.
- Do not execute macros or embedded content.
- Do not render unsanitized extracted HTML.
- Release object URLs and temporary in-memory data when no longer needed.

## 3. Logging

Do not log:

- Full text.
- Full filenames if they may be sensitive.
- File contents.
- Exported comments.

Logs may include:

- Rule identifier.
- Error category.
- Anonymized document ID.
- Character count.
- Duration.

## 4. Storage

- Do not persist text in local storage by default.
- If draft recovery is added, make it opt-in and provide a clear delete action.
- Do not retain uploaded files after the active session unless explicitly requested.

## 5. Export safety

- Always create a new output file.
- Sanitize generated filenames.
- Preserve the original extension only for the correct exporter.
- Do not silently alter unsupported document structures.

## 6. Dependency safety

- Keep dependencies minimal.
- Commit lockfiles.
- Enable dependency scanning in GitHub.
- Review libraries that parse DOCX/PDF carefully because parsers process untrusted input.

## 7. Future remote processing

Before enabling remote processing, document:

- Provider and region.
- Data retention policy.
- Encryption in transit and at rest.
- Authentication and authorization.
- Tenant isolation.
- User consent.
- Deletion workflow.
- Whether content trains external models.
