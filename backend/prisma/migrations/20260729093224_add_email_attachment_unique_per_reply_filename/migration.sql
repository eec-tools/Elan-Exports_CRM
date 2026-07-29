-- Prevent duplicate attachment rows for the same reply+filename. The Gmail
-- attachment sync previously deduped by Gmail's attachmentId, which is not
-- stable across repeated API fetches, so the same physical attachment kept
-- getting re-inserted on every poll.
ALTER TABLE "supplier_email_attachments" ADD CONSTRAINT "supplier_email_attachments_reply_id_filename_key" UNIQUE ("reply_id", "filename");

ALTER TABLE "buyer_email_attachments" ADD CONSTRAINT "buyer_email_attachments_reply_id_filename_key" UNIQUE ("reply_id", "filename");
