// Cliente web AVI. Apenas chave publishable; operações públicas sensíveis passam por Edge Functions.
(async () => {
  const cfg = window.AVI_SUPABASE_CONFIG || {};
  if (!cfg.url || !cfg.publishableKey) {
    window.aviCloud = { enabled:false, reason:"Configuração Supabase ausente." };
    window.dispatchEvent(new Event("avi-cloud-ready"));
    return;
  }
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.95.0");
    const client = createClient(cfg.url, cfg.publishableKey, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });
    const invoke = async (name, body) => {
      const {data,error}=await client.functions.invoke(name,{body});
      if(error) throw error;
      if(data?.error) throw new Error(data.error);
      return data;
    };
    window.aviCloud = {
      enabled:true, client,
      async signUp(name,email,password,consent) {
        const {data,error}=await client.auth.signUp({email,password,options:{data:{
          full_name:name,avi_terms_accepted:!!consent,avi_adult_attested:!!consent,
          avi_terms_version:"AVI-TERMOS-2026-11",avi_privacy_version:"AVI-PRIVACIDADE-2026-11"
        }}});
        if(error) throw error; return data;
      },
      async signIn(email,password) {
        const {data,error}=await client.auth.signInWithPassword({email,password});
        if(error) throw error; return data;
      },
      async signInWithGoogle() {
        const redirectTo = window.location.origin + window.location.pathname;
        const {data,error}=await client.auth.signInWithOAuth({
          provider:"google",
          options:{
            redirectTo,
            queryParams:{ access_type:"online", prompt:"select_account" }
          }
        });
        if(error) throw error; return data;
      },
      async signOut() { const {error}=await client.auth.signOut(); if(error) throw error; },
      async user() {
        const {data,error}=await client.auth.getSession();
        if(error) throw error;
        return data?.session?.user || null;
      },
      async session() {
        const {data,error}=await client.auth.getSession();
        if(error) throw error;
        return data?.session || null;
      },
      async profile() {
        const u=await this.user(); if(!u) return null;
        const {data,error}=await client.from("avi_profiles").select("id,full_name").eq("id",u.id).maybeSingle();
        if(error) throw error; return data;
      },
      async saveVolunteer(form) { return await invoke("avi-public-intake",{kind:"volunteer",...form,website:""}); },
      async saveDonation(form) { return await invoke("avi-public-intake",{kind:"donation",...form,website:""}); },
      async listModules() {
        const {data,error}=await client.from("avi_learning_modules").select("id,slug,title,description,icon,display_order,status").eq("status","published").order("display_order");
        if(error) throw error; return data||[];
      },
      async listCourses(moduleId=null) {

        let query=client.from("avi_courses").select("id,slug,title,description,level,module_id,avi_lessons(id,title,position)").eq("published",true).order("title");
        if(moduleId) query=query.eq("module_id",moduleId);
        const {data,error}=await query;
        if(error) throw error; return data||[];
      },
      async listCourseLessons(courseId) {
        const {data,error}=await client.from("avi_lessons").select("id,title,content_md,position").eq("course_id",courseId).eq("published",true).order("position");
        if(error) throw error; return data||[];
      },
      async enroll(courseId) {
        const u=await this.user(); if(!u) throw new Error("Entre na sua conta para se matricular.");
        const {data:exists,error:findError}=await client.from("avi_enrollments").select("id").eq("student_id",u.id).eq("course_id",courseId).maybeSingle();
        if(findError) throw findError;
        if(exists) return exists;
        const {data,error}=await client.from("avi_enrollments").insert({student_id:u.id,course_id:courseId}).select().single();
        if(error) throw error; return data;
      },
      async saveLessonProgress(lessonId) {
        const u=await this.user(); if(!u) throw new Error("Entre na sua conta para salvar o progresso.");
        const {data,error}=await client.from("avi_lesson_progress").upsert({student_id:u.id,lesson_id:lessonId,completed_at:new Date().toISOString()},{onConflict:"student_id,lesson_id"}).select().single();
        if(error) throw error; return data;
      },
      async saveLearningActivity(activityType,payload) {
        const u=await this.user(); if(!u) return {synced:false,reason:"not_signed_in"};
        const allowed=["assessment","flashcard_review","mindmap_view"];
        if(!allowed.includes(activityType)) throw new Error("Tipo de atividade inválido.");
        const safePayload=JSON.parse(JSON.stringify(payload||{}));
        const {data,error}=await client.from("avi_learning_activity").insert({user_id:u.id,activity_type:activityType,payload:safePayload}).select("id,activity_type,created_at").single();
        if(error) throw error; return {synced:true,data};
      },
      async listMyLearningActivity(limit=100) {
        const u=await this.user(); if(!u) return [];
        const {data,error}=await client.from("avi_learning_activity").select("id,activity_type,payload,created_at").eq("user_id",u.id).order("created_at",{ascending:false}).limit(Math.min(Math.max(Number(limit)||100,1),200));
        if(error) throw error; return data||[];
      },
      async createClass(name,description="") {
        const u=await this.user(); if(!u) throw new Error("Entre na sua conta.");
        const {data,error}=await client.from("avi_classes").insert({name,description,owner_user_id:u.id}).select("id,name,description,status").single();
        if(error) throw error; return data;
      },
      async listMyClasses() {
        const u=await this.user(); if(!u) return [];
        const {data,error}=await client.from("avi_class_memberships").select("role,status,avi_classes(id,name,description,status,join_code)").eq("user_id",u.id).eq("status","active");
        if(error) throw error;
        const {data:owned,error:ownErr}=await client.from("avi_classes").select("id,name,description,status,join_code").eq("owner_user_id",u.id);
        if(ownErr) throw ownErr;
        return [...(owned||[]).map(x=>({...x,role:"educator"})),...(data||[]).map(x=>({...x.avi_classes,role:x.role})).filter(x=>x.id)];
      },
      async requestClassJoin(classId) {
        const u=await this.user(); if(!u) throw new Error("Entre na sua conta.");
        const {data,error}=await client.from("avi_class_memberships").insert({class_id:classId,user_id:u.id,role:"student",status:"pending"}).select("id").single();
        if(error) throw error; return data;
      },
      async listPendingRequests() {
        const u=await this.user(); if(!u) return [];
        const {data,error}=await client.from("avi_class_memberships").select("id,user_id,avi_profiles(full_name),avi_classes!inner(id,name,owner_user_id)").eq("status","pending").eq("avi_classes.owner_user_id",u.id);
        if(error) throw error;
        return (data||[]).map(x=>({id:x.id,student_name:x.avi_profiles?.full_name||"Estudante",class_name:x.avi_classes?.name}));
      },
      async reviewClassRequest(id,approved) {
        const {error}=await client.from("avi_class_memberships").update({status:approved?"active":"rejected",approved_at:approved?new Date().toISOString():null}).eq("id",id);
        if(error) throw error;
      },
      async createAssignment(classId,title,description,dueDate) {
        const u=await this.user(); if(!u) throw new Error("Entre na sua conta.");
        const rubricText=document.querySelector("#aviAssignmentRubric")?.value||"";
        const rubric=rubricText.split("\\n").map(x=>x.trim()).filter(Boolean).map((label,i)=>({id:i+1,label,weight:1}));
        const {data,error}=await client.from("avi_class_assignments").insert({class_id:classId,educator_user_id:u.id,title,description,due_date:dueDate,rubric}).select().single();
        if(error) throw error; return data;
      },
      async listAssignments(classId) {
        const u=await this.user(); if(!u) return [];
        const {data,error}=await client.from("avi_class_assignments").select("id,title,description,due_date,status").eq("class_id",classId).eq("status","published").order("created_at",{ascending:false});
        if(error) throw error;
        const {data:mine,error:mineErr}=await client.from("avi_assignment_submissions").select("assignment_id").eq("student_user_id",u.id).in("assignment_id",(data||[]).map(x=>x.id).length?(data||[]).map(x=>x.id):["00000000-0000-0000-0000-000000000000"]);
        if(mineErr) throw mineErr; const sent=new Set((mine||[]).map(x=>x.assignment_id));
        return (data||[]).map(x=>({...x,can_submit:!sent.has(x.id)}));
      },
      async submitAssignment(assignmentId,answer) {
        const u=await this.user(); if(!u) throw new Error("Entre na sua conta.");
        const {data,error}=await client.from("avi_assignment_submissions").insert({assignment_id:assignmentId,student_user_id:u.id,answer}).select().single();
        if(error) throw error; return data;
      },
      async listMyClasses() {
        const u=await this.user(); if(!u) return [];
        const {data,error}=await client.from("avi_class_memberships").select("role,status,avi_classes(id,name,description,status)").eq("user_id",u.id).eq("status","active");
        if(error) throw error;
        const {data:owned,error:ownErr}=await client.from("avi_classes").select("id,name,description,status").eq("owner_user_id",u.id);
        if(ownErr) throw ownErr;
        return [...(owned||[]).map(x=>({...x,role:"educator"})),...(data||[]).map(x=>({...x.avi_classes,role:x.role})).filter(x=>x.id)];
      },
      async requestClassJoin(classId) {
        const u=await this.user(); if(!u) throw new Error("Entre na sua conta.");
        const {data,error}=await client.from("avi_class_memberships").insert({class_id:classId,user_id:u.id,role:"student",status:"pending"}).select("id").single();
        if(error) throw error; return data;
      },
      async listPendingRequests() {
        const u=await this.user(); if(!u) return [];
        const {data,error}=await client.from("avi_class_memberships").select("id,avi_profiles(full_name),avi_classes!inner(id,name,owner_user_id)").eq("status","pending").eq("avi_classes.owner_user_id",u.id);
        if(error) throw error;
        return (data||[]).map(x=>({id:x.id,student_name:x.avi_profiles?.full_name||"Estudante",class_name:x.avi_classes?.name}));
      },
      async reviewClassRequest(id,approved) {
        const {error}=await client.from("avi_class_memberships").update({status:approved?"active":"rejected",reviewed_at:new Date().toISOString(),reviewed_by:(await this.user()).id}).eq("id",id);
        if(error) throw error;
      },
      async createAssignment(classId,title,description,dueDate) {
        const u=await this.user(); if(!u) throw new Error("Entre na sua conta.");
        const rubricText=document.querySelector("#aviAssignmentRubric")?.value||"";
        const rubric=rubricText.split("\\n").map(x=>x.trim()).filter(Boolean).map((label,i)=>({id:i+1,label,weight:1}));
        const {data,error}=await client.from("avi_class_assignments").insert({class_id:classId,educator_user_id:u.id,title,description,due_date:dueDate,rubric}).select().single();
        if(error) throw error; return data;
      },
      async listAssignments(classId) {
        const u=await this.user(); if(!u) return [];
        const {data,error}=await client.from("avi_class_assignments").select("id,title,description,due_date,status").eq("class_id",classId).eq("status","published").order("created_at",{ascending:false});
        if(error) throw error;
        const ids=(data||[]).map(x=>x.id); if(!ids.length)return [];
        const {data:mine,error:mineErr}=await client.from("avi_assignment_submissions").select("assignment_id").eq("student_user_id",u.id).in("assignment_id",ids);
        if(mineErr) throw mineErr; const sent=new Set((mine||[]).map(x=>x.assignment_id));
        return (data||[]).map(x=>({...x,can_submit:!sent.has(x.id)}));
      },
      async submitAssignment(assignmentId,answer) {
        const u=await this.user(); if(!u) throw new Error("Entre na sua conta.");
        const {data,error}=await client.from("avi_assignment_submissions").insert({assignment_id:assignmentId,student_user_id:u.id,answer}).select().single();
        if(error) throw error; return data;
      },
      async listClassStudents(classId) {
        const {data,error}=await client.from("avi_class_memberships").select("user_id,avi_profiles(full_name)").eq("class_id",classId).eq("role","student").eq("status","active");
        if(error) throw error; return (data||[]).map(x=>({user_id:x.user_id,full_name:x.avi_profiles?.full_name||"Estudante"}));
      },
      async listClassSubmissions(classId) {
        const {data,error}=await client.from("avi_assignment_submissions").select("id,answer,submitted_at,grade,educator_feedback,avi_class_assignments!inner(title,class_id)").eq("avi_class_assignments.class_id",classId).order("submitted_at",{ascending:false});
        if(error) throw error;
        return (data||[]).map(x=>({id:x.id,answer:x.answer,submitted_at:x.submitted_at,grade:x.grade,feedback:x.educator_feedback,assignment_title:x.avi_class_assignments?.title,student_name:"Estudante"}));
      },
      async reviewSubmission(id,grade,feedback) {
        const u=await this.user(); if(!u) throw new Error("Entre na sua conta.");
        const {error}=await client.from("avi_assignment_submissions").update({grade,educator_feedback:feedback,reviewed_at:new Date().toISOString(),reviewed_by:u.id}).eq("id",id);
        if(error) throw error;
      },
      async recordAttendance(classId,studentId,date,status,note) {
        const u=await this.user(); if(!u) throw new Error("Entre na sua conta.");
        const {data,error}=await client.from("avi_class_attendance").upsert({class_id:classId,student_user_id:studentId,attendance_date:date,status,note,recorded_by:u.id},{onConflict:"class_id,student_user_id,attendance_date"}).select().single();
        if(error) throw error; return data;
      },
      async getClassReport(classId) {
        const {data:members,error:mErr}=await client.from("avi_class_memberships").select("id").eq("class_id",classId).eq("role","student").eq("status","active"); if(mErr)throw mErr;
        const {data:subs,error:sErr}=await client.from("avi_assignment_submissions").select("grade,avi_class_assignments!inner(class_id)").eq("avi_class_assignments.class_id",classId);if(sErr)throw sErr;
        const {data:att,error:aErr}=await client.from("avi_class_attendance").select("status").eq("class_id",classId);if(aErr)throw aErr;
        const grades=(subs||[]).map(x=>x.grade).filter(x=>x!==null&&x!==undefined).map(Number);
        const attended=(att||[]).filter(x=>x.status==="present").length;
        return {students:(members||[]).length,submissions:(subs||[]).length,average_grade:grades.length?grades.reduce((a,b)=>a+b,0)/grades.length:null,attendance_rate:(att||[]).length?100*attended/att.length:null};
      },
      async createCollaborativeProject(classId,title,description) {
        const u=await this.user(); if(!u) throw new Error("Entre na sua conta.");
        const payload={owner_user_id:u.id,title,description};
        if(classId) payload.class_id=classId;
        const {data,error}=await client.from("avi_collab_projects").insert(payload).select("id,title,description,class_id,invite_code,status,created_at").single();
        if(error) throw error; return data;
      },
      async joinCollaborativeProject(inviteCode) {
        const u=await this.user(); if(!u) throw new Error("Entre na sua conta.");
        const {data,error}=await client.rpc("avi_join_collaborative_project",{p_invite_code:inviteCode});
        if(error) throw error; return data;
      },
      async listCollaborativeProjects() {
        const u=await this.user(); if(!u) return [];
        const {data,error}=await client.from("avi_collab_project_members").select("role,avi_collab_projects(id,title,description,class_id,invite_code,status,created_at)").eq("user_id",u.id).eq("status","active");
        if(error) throw error;
        const {data:owned,error:ownErr}=await client.from("avi_collab_projects").select("id,title,description,class_id,invite_code,status,created_at").eq("owner_user_id",u.id);
        if(ownErr) throw ownErr;
        const map=new Map();
        (owned||[]).forEach(p=>map.set(p.id,{...p,role:"owner"}));
        (data||[]).forEach(x=>{if(x.avi_collab_projects)map.set(x.avi_collab_projects.id,{...x.avi_collab_projects,role:x.role})});
        return [...map.values()].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
      },
      async listCollaborativeMembers(projectId) {
        const {data,error}=await client.from("avi_collab_project_members").select("user_id,role").eq("project_id",projectId).eq("status","active");
        if(error) throw error; return data||[];
      },
      async listCollaborativeTasks(projectId) {
        const {data,error}=await client.from("avi_collab_tasks").select("id,title,description,assignee_user_id,status,due_date,created_at").eq("project_id",projectId).order("created_at",{ascending:true});
        if(error) throw error; return data||[];
      },
      async createCollaborativeTask(projectId,title,description,assignee,dueDate) {
        const u=await this.user(); if(!u) throw new Error("Entre na sua conta.");
        const payload={project_id:projectId,created_by:u.id,title,description,assignee_user_id:assignee||null,due_date:dueDate||null};
        const {data,error}=await client.from("avi_collab_tasks").insert(payload).select().single();
        if(error) throw error; return data;
      },
      async updateCollaborativeTask(taskId,status) {
        const {error}=await client.from("avi_collab_tasks").update({status,updated_at:new Date().toISOString()}).eq("id",taskId);
        if(error) throw error;
      },
      async addProjectPortfolioItem(projectId,title,description,url) {
        const u=await this.user(); if(!u) throw new Error("Entre na sua conta.");
        const {data,error}=await client.from("avi_project_portfolio").insert({project_id:projectId,author_user_id:u.id,title,description,resource_url:url||null}).select().single();
        if(error) throw error; return data;
      },
      async listProjectPortfolio(projectId) {
        const {data,error}=await client.from("avi_project_portfolio").select("id,title,description,resource_url,author_user_id,created_at").eq("project_id",projectId).order("created_at",{ascending:false});
        if(error) throw error; return data||[];
      },
      async addProjectFeedback(projectId,memberId,feedback) {
        const u=await this.user(); if(!u) throw new Error("Entre na sua conta.");
        const {data,error}=await client.from("avi_project_feedback").insert({project_id:projectId,member_user_id:memberId,educator_user_id:u.id,feedback}).select().single();
        if(error) throw error; return data;
      },
      async tutor(message) { return await invoke("avi-tutor",{message}); },
      async adminOverview() { return await invoke("avi-admin",{action:"overview"}); }
    };
    client.auth.onAuthStateChange((event, session) => {
      window.dispatchEvent(new CustomEvent("avi-auth-changed", {detail:{event,hasSession:!!session}}));
    });
  } catch (e) {
    window.aviCloud = { enabled:false, reason:e.message||"Falha ao inicializar Supabase." };
  }
  window.dispatchEvent(new Event("avi-cloud-ready"));
})();
