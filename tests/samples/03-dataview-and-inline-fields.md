# Dataview and Inline Fields

Here is a paragraph with an inline field:
Author:: Alice Walker
Priority:: High
Status:: in-progress

```dataview
TABLE file.mtime AS "Modified", tags AS "Tags"
FROM #project
SORT file.mtime DESC
```

And a DataviewJS script block:

```dataviewjs
dv.taskList(dv.pages("#project").file.tasks.where(t => !t.completed));
```

The code blocks above should render with a "Not run" indicator and never execute.
