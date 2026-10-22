"use strict";
/** Acceso curricular. El PIN y los enlaces se comprueban solo en Firebase Functions. */
const crypto = require("node:crypto");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
const ADMIN_PIN = "5626"; // Valor solicitado. Repositorio publico: NO es un secreto.
const REGION = "us-central1";
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const sameHash = (left,right) => /^[a-f0-9]{64}$/.test(right||"") && crypto.timingSafeEqual(Buffer.from(sha(left),"hex"),Buffer.from(right,"hex"));
const fail = (code,message) => {throw new HttpsError(code,message);};
const cfg = { region:REGION, cors:["https://jeffer91.github.io"], maxInstances:10, memory:"256MiB", timeoutSeconds:60 };
const message = err => String(err?.message || err || "Sin detalle").slice(0,250);
function cause(err){const s=message(err).toLowerCase();if(/signblob|serviceaccount|permission iam\.serviceaccounts|iam\.googleapis\.com/.test(s))return "Falta habilitar IAM Service Account Credentials API o conceder Service Account Token Creator a la cuenta de servicio de Functions (segunda generación).";if(/firestore|database.*not.*found|permission_denied|permission denied/.test(s))return "La función no puede consultar Firestore. Comprueba que el proyecto tiene Firestore creado y que su cuenta de servicio puede acceder.";return "La función de Firebase falló; revisa los registros de Cloud Functions para identificar la causa exacta.";}
async function controlled(label,operation){try{return await operation();}catch(err){if(err instanceof HttpsError)throw err;logger.error(label,{code:err?.code||"error",message:message(err)});throw new HttpsError("failed-precondition",cause(err));}}
function checkRole(request){
  if(!request.auth || request.auth.token.rol!=="administrador" || request.auth.uid!=="curriculo-admin-pin")
    fail("permission-denied","Solo el administrador puede emitir enlaces.");
}
function validCareer(id){return typeof id==="string" && /^carrera_[a-z0-9_]{2,100}$/.test(id);}
async function attempts(kind,request,limit,interval){
  const ip = String(request.rawRequest?.ip||request.rawRequest?.headers?.["x-forwarded-for"]?.split(",")[0]||"desconocida");
  const id = sha(kind+"|"+ip);
  const ref=db.collection("_curriculo_intentos").doc(id);
  const now=Date.now();
  const result=await db.runTransaction(async tx=>{
    const snap=await tx.get(ref),old=snap.exists?snap.data():{};
    const start=Number(old.inicio||0),count=(now-start<interval)?Number(old.contador||0):0;
    if(count>=limit) return false;
    tx.set(ref,{inicio:(now-start<interval)?start:now,contador:count+1,ultima:admin.firestore.FieldValue.serverTimestamp()});
    return true;
  });
  if(!result)fail("resource-exhausted","Demasiados intentos. Intenta de nuevo después del periodo de bloqueo.");
}
exports.ingresarAdmin = onCall(cfg,async request=>{
  await controlled("Limite de intentos de administrador",()=>attempts("pin-admin",request,20,15*60*1000));
  const pin=request.data?.pin;
  if(typeof pin!=="string" || !/^\d{4}$/.test(pin))fail("invalid-argument","Introduce un PIN de cuatro dígitos.");
  const configured=ADMIN_PIN;
  const match=crypto.timingSafeEqual(Buffer.from(pin),Buffer.from(configured));
  if(!match)fail("permission-denied","PIN incorrecto.");
  const token=await controlled("Firma token administrador",()=>admin.auth().createCustomToken("curriculo-admin-pin",{rol:"administrador"}));
  return {token};
});
exports.crearEnlaceCarrera=onCall(cfg,async request=>{
  checkRole(request);
  const carreraId=request.data?.carreraId;
  if(!validCareer(carreraId))fail("invalid-argument","ID de carrera inválido.");
  const career=await db.collection("carreras").doc(carreraId).get();
  if(!career.exists)fail("not-found","La carrera no existe.");
  const token=crypto.randomBytes(32).toString("base64url");
  const ref=db.collection("enlaces_curriculares").doc(carreraId);
  await db.runTransaction(async tx=>{
    const current=await tx.get(ref);
    const version=(current.exists?Number(current.data().version||0):0)+1;
    tx.set(ref,{
      carreraId,
      tokenHash:sha(token),
      activo:true,
      version,
      generadoEn:admin.firestore.FieldValue.serverTimestamp(),
      generadoPor:"administrador-pin"
    });
  });
  // El secreto se coloca en el fragmento: no viaja al servidor de GitHub Pages.
  const url="https://jeffer91.github.io/curriculopg/coordinador/?carrera="+encodeURIComponent(carreraId)+"#acceso="+encodeURIComponent(token);
  return {url,carreraId,mensaje:"Guarda este enlace: no se puede recuperar y el anterior fue revocado."};
});
exports.revocarEnlaceCarrera=onCall(cfg,async request=>{
  checkRole(request);
  const carreraId=request.data?.carreraId;
  if(!validCareer(carreraId))fail("invalid-argument","ID de carrera inválido.");
  const ref=db.collection("enlaces_curriculares").doc(carreraId);
  await db.runTransaction(async tx=>{
    const doc=await tx.get(ref);
    if(!doc.exists)fail("not-found","No hay enlace para esa carrera.");
    const version=Number(doc.data().version||0)+1;
    tx.update(ref,{activo:false,version,revocadoEn:admin.firestore.FieldValue.serverTimestamp()});
  });
  return {ok:true};
});
exports.ingresarCoordinador=onCall(cfg,async request=>{
  await controlled("Limite de intentos del coordinador",()=>attempts("enlace-carrera",request,60,60*60*1000));
  const {carreraId,acceso}=request.data||{};
  if(!validCareer(carreraId) || typeof acceso!=="string" || !/^[A-Za-z0-9_-]{35,60}$/.test(acceso))
    fail("permission-denied","Enlace de coordinador inválido.");
  const record=await db.collection("enlaces_curriculares").doc(carreraId).get();
  if(!record.exists || record.data().activo!==true || !sameHash(acceso,record.data().tokenHash))
    fail("permission-denied","Este enlace es inválido o fue reemplazado.");
  const uid="curriculo-coordinador-"+sha(carreraId).slice(0,30);
  const token=await controlled("Firma token coordinador",()=>admin.auth().createCustomToken(uid,{rol:"coordinador",carreraId,versionEnlace:record.data().version}));
  return {token};
});


// Diagnóstico no destructivo: nunca devuelve tokens, IDs internos ni documentos académicos.
// El PIN ya está en un repositorio público por requerimiento: NO es una barrera real de seguridad.
exports.diagnosticarCurriculo = onCall(cfg,async request=>{
  if(request.data?.pin!==ADMIN_PIN)fail("permission-denied","PIN incorrecto.");
  let firestore="ok",firmaTokens="ok";
  try{await db.collection("carreras").limit(1).get();}
  catch(err){firestore="error";logger.error("Diagnostico Firestore",{code:err?.code||"error",message:message(err)});}
  try{await admin.auth().createCustomToken("curriculo-diagnostico");}
  catch(err){firmaTokens="error";logger.error("Diagnostico firma",{code:err?.code||"error",message:message(err)});}
  return {funcion:"ok",firestore,firmaTokens,descripcion:"No se modificó ninguna colección. Los registros completos se consultan desde Google Cloud."};
});
