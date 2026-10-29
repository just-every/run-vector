-- Quoted source positions travel with comments in archives and disappear with
-- their tombstone. Applied description changes retain the original quote.
ALTER TABLE issue_comments ADD COLUMN description_anchor TEXT CHECK(description_anchor IS NULL OR json_valid(description_anchor));

CREATE TRIGGER issue_description_anchors_changed AFTER UPDATE OF description ON issues
WHEN NEW.description <> OLD.description
BEGIN
  UPDATE issue_comments SET description_anchor = (
    -- Binary searches find the unchanged prefix and suffix without scanning
    -- once per source character. Suffixes never overlap the common prefix.
    WITH RECURSIVE
    prefix(lo,hi) AS (
      SELECT 0,min(length(OLD.description),length(NEW.description))
      UNION ALL
      SELECT CASE WHEN substr(OLD.description,1,(lo+hi+1)/2)=substr(NEW.description,1,(lo+hi+1)/2) THEN (lo+hi+1)/2 ELSE lo END,
             CASE WHEN substr(OLD.description,1,(lo+hi+1)/2)=substr(NEW.description,1,(lo+hi+1)/2) THEN hi ELSE (lo+hi+1)/2-1 END
      FROM prefix WHERE lo<hi
    ),
    p(n) AS (SELECT lo FROM prefix WHERE lo=hi),
    suffix(lo,hi) AS (
      SELECT 0,min(length(OLD.description),length(NEW.description))-(SELECT n FROM p)
      UNION ALL
      SELECT CASE WHEN substr(OLD.description,length(OLD.description)-(lo+hi+1)/2+1)=substr(NEW.description,length(NEW.description)-(lo+hi+1)/2+1) THEN (lo+hi+1)/2 ELSE lo END,
             CASE WHEN substr(OLD.description,length(OLD.description)-(lo+hi+1)/2+1)=substr(NEW.description,length(NEW.description)-(lo+hi+1)/2+1) THEN hi ELSE (lo+hi+1)/2-1 END
      FROM suffix WHERE lo<hi
    ),
    bounds(a,b,delta) AS (SELECT p.n,length(OLD.description)-suffix.lo,length(NEW.description)-length(OLD.description) FROM p,suffix WHERE suffix.lo=suffix.hi)
    , quote(source,at) AS (SELECT substr(OLD.description,json_extract(description_anchor,'$.start')+1,json_extract(description_anchor,'$.end')-json_extract(description_anchor,'$.start')),json_extract(description_anchor,'$.start')+1),
    located(source,oldAt,newAt) AS (SELECT source,at,instr(NEW.description,source) FROM quote)
    SELECT CASE
      WHEN json_extract(description_anchor,'$.end')<=a THEN description_anchor
      WHEN json_extract(description_anchor,'$.start')>=b THEN json_set(description_anchor,
        '$.start',json_extract(description_anchor,'$.start')+delta,
        '$.end',json_extract(description_anchor,'$.end')+delta)
      -- An unchanged, unique source quote can survive edits on both sides.
      -- Ambiguous repeated text never jumps to another occurrence.
      WHEN newAt>0 AND instr(OLD.description,source)=oldAt
        AND instr(substr(OLD.description,oldAt+length(source)),source)=0
        AND instr(substr(NEW.description,newAt+length(source)),source)=0
      THEN json_set(description_anchor,'$.start',newAt-1,'$.end',newAt-1+length(source))
      ELSE json_set(description_anchor,'$.removed',json('true')) END FROM bounds,located
  ) WHERE issue_id=NEW.id AND description_anchor IS NOT NULL AND json_extract(description_anchor,'$.removed')=0;
END;

CREATE TRIGGER issue_comment_anchor_deleted AFTER UPDATE OF deleted_at ON issue_comments
WHEN NEW.deleted_at IS NOT NULL AND NEW.description_anchor IS NOT NULL
BEGIN
  UPDATE issue_comments SET description_anchor=NULL WHERE id=NEW.id;
END;
