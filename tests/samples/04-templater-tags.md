# Templater Tags Note

Today is <% tp.date.now("YYYY-MM-DD") %> and the current time is <% tp.date.now("HH:mm") %>.

Title placeholder: <% tp.file.title %>

Execution block:
<%*
if (tp.file.title.startsWith("Daily")) {
    tR += "Welcome to your daily note!";
} else {
    tR += "Standard project note.";
}
_%>

These tags must be kept byte-for-byte as written and never executed.
