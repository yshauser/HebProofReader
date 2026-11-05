import { useId } from "react";
import { DOCX_ACCEPT } from "./accept";

interface DocxUploadProps {
  loading: boolean;
  onFile: (file: File) => void;
}

export function DocxUpload({ loading, onFile }: DocxUploadProps) {
  const id = useId();
  return (
    <div className="file-picker">
      <input
        id={id}
        type="file"
        className="file-picker__input"
        accept={DOCX_ACCEPT}
        disabled={loading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <label htmlFor={id} className="file-picker__label">
        {loading ? "טוען קובץ…" : "העלאת קובץ DOCX"}
      </label>
    </div>
  );
}
