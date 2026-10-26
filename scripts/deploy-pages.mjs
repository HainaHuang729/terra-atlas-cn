import {execFileSync} from 'node:child_process';

const run=(command,args,options={})=>execFileSync(command,args,{encoding:'utf8',stdio:['pipe','pipe','pipe'],...options}).trim();
const api=(path,payload)=>JSON.parse(run('gh',['api',...(payload?['--method','POST','--input','-']:[]),path],payload?{input:JSON.stringify(payload)}:{}));
if(run('git',['status','--porcelain']))throw new Error('Commit the changes before deploying.');
const repo=JSON.parse(run('gh',['repo','view','--json','nameWithOwner'])).nameWithOwner;
if(!/^[a-z\d_.-]+\/[a-z\d_.-]+$/i.test(repo))throw new Error('Unexpected GitHub repository name.');
const source=run('git',['rev-parse','HEAD']);
const remote=api('repos/'+repo+'/git/ref/heads/main').object.sha;
if(source!==remote)throw new Error('Push the current source commit to main before deploying.');
const tree=run('git',['rev-parse','HEAD:dist']);
// The source push already uploaded the entire dist tree. A new commit can reuse it.
api('repos/'+repo+'/git/trees/'+tree);
let before=null;
try{before=api('repos/'+repo+'/git/ref/heads/gh-pages').object.sha;}
catch(error){if(!String(error.stderr).includes('HTTP 404'))throw error;}
const user=api('user');
const author={name:user.login,email:user.id+'+'+user.login+'@users.noreply.github.com',date:new Date().toISOString()};
const commit=api('repos/'+repo+'/git/commits',{message:'Deploy atlas from '+source,tree,parents:before?[before]:[],author,committer:author});
if(before){
  // A concurrent divergent update is rejected: the new commit has the previous head as its parent.
  run('gh',['api','--method','PATCH','repos/'+repo+'/git/refs/heads/gh-pages','--input','-'],{input:JSON.stringify({sha:commit.sha,force:false})});
}else api('repos/'+repo+'/git/refs',{ref:'refs/heads/gh-pages',sha:commit.sha});
console.log(JSON.stringify({repository:repo,sourceCommit:source,pagesCommit:commit.sha,tree,branch:'gh-pages'}));
