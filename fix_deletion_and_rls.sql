-- 1. إصلاح الحذف (Deletion)
-- عند حذف جلسة حوار، يجب حذف الاتفاق المرتبط بها تلقائياً (Cascade)
ALTER TABLE agreements 
DROP CONSTRAINT IF EXISTS agreements_origin_dialogue_id_fkey;

ALTER TABLE agreements 
ADD CONSTRAINT agreements_origin_dialogue_id_fkey 
FOREIGN KEY (origin_dialogue_id) 
REFERENCES dialogues(id) 
ON DELETE CASCADE;

-- 2. تأكيد صلاحيات الحذف والتعديل
DROP POLICY IF EXISTS "Users can delete their own dialogues" ON dialogues;
CREATE POLICY "Users can delete their own dialogues"
ON dialogues FOR DELETE
USING (auth.uid() = created_by_user_id OR auth.uid() IN (
    SELECT user1_id FROM partnerships WHERE id = partnership_id
    UNION
    SELECT user2_id FROM partnerships WHERE id = partnership_id
));

DROP POLICY IF EXISTS "Users can update their own agreements" ON agreements;
CREATE POLICY "Users can update their own agreements"
ON agreements FOR UPDATE
USING (auth.uid() = created_by_user_id OR auth.uid() IN (
    SELECT user1_id FROM partnerships WHERE id = partnership_id
    UNION
    SELECT user2_id FROM partnerships WHERE id = partnership_id
));

DROP POLICY IF EXISTS "Users can delete their own agreements" ON agreements;
CREATE POLICY "Users can delete their own agreements"
ON agreements FOR DELETE
USING (auth.uid() = created_by_user_id OR auth.uid() IN (
    SELECT user1_id FROM partnerships WHERE id = partnership_id
    UNION
    SELECT user2_id FROM partnerships WHERE id = partnership_id
));
