from pypdf import PdfReader
from docx import Document
import io

def extract_text_from_file(file_storage):
    """
    Takes a Flask file upload object and returns extracted plain text.
    Supports PDF and DOCX. Raises ValueError for unsupported types.
    """
    filename = file_storage.filename.lower()

    if filename.endswith(".pdf"):
        return _extract_from_pdf(file_storage)
    elif filename.endswith(".docx"):
        return _extract_from_docx(file_storage)
    else:
        raise ValueError("Unsupported file type. Please upload a PDF or DOCX file.")


def _extract_from_pdf(file_storage):
    reader = PdfReader(file_storage)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    return text


def _extract_from_docx(file_storage):
    # python-docx needs a file-like object, so we read into memory first
    file_bytes = io.BytesIO(file_storage.read())
    doc = Document(file_bytes)
    text = "\n".join(paragraph.text for paragraph in doc.paragraphs)
    return text