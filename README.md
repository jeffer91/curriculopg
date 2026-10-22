# Currículo ITSQMET — Gestión curricular

Repositorio público que despliega **dos aplicaciones** independientes en GitHub Pages:

- Administrador: https://jeffer91.github.io/curriculopg/administrador/
- Coordinador: enlace **privado diferente para cada carrera**, generado por el administrador. No basta con \`?carrera=\` sin la clave de acceso.

## Acceso sin cuentas visibles

- **Administrador**: solo ingresa el PIN `5626` definido en el código. No se solicita correo ni contraseña. Si las funciones no están desplegadas, se abre una vista local de configuración, **sin acceder a los datos de Firebase**.
- **Coordinador**: no ingresa PIN, usuario ni contraseña; abre su enlace secreto, que contiene \`?carrera=...\#acceso=...\`.
- El navegador comprueba localmente el PIN para habilitar la vista y, si las funciones están desplegadas, solicita una sesión de Firebase Authentication con claims firmados. Los permisos de lectura y escritura se comprueban en Firestore.
- El administrador puede generar, **renovar** (invalidando el anterior) o **revocar** enlaces desde «Carreras y enlaces».
- Los enlaces se guardan en Firestore **solo como hashes** y se muestran completos únicamente cuando se generan. Deben copiarse en ese momento.
- Cuando se revoca o renueva un enlace, Firestore rechaza las sesiones de la versión anterior.
- No se almacenan secretos de administrador ni tokens de coordinador en GitHub.

## Activación requerida en Firebase (no se realiza al publicar en GitHub)

El repositorio aporta el backend de Firebase Functions, pero **GitHub Pages solo despliega el frontend**. Para que funcionen el PIN y los enlaces reales, se requieren los siguientes pasos de una persona con acceso autorizado al proyecto \`curriculo-ddfcd\`:

1. Firebase debe tener **Authentication** y **Firestore** habilitados. En la pestaña Authentication → Settings → Authorized domains, verificar que se admitan los dominios usados por la aplicación cuando corresponda. El acceso con token personalizado no requiere habilitar Email/Password.
2. El proyecto debe estar en **Blaze** (facturación habilitada) para desplegar Cloud Functions de segunda generación.
3. En una terminal con acceso al proyecto:

   \`\`\`bash
   npm install -g firebase-tools
   firebase login
   firebase use curriculo-ddfcd
   npm install --prefix functions
   # El PIN ya está definido en functions/index.js.
   firebase deploy --only functions
   \`\`\`

4. Revisar las reglas actualmente publicadas en **Firestore → Rules**. Integrar las condiciones del archivo \`firestore.rules\` **sin borrar las reglas de otras aplicaciones** que compartan Firebase. Publicar las reglas ya fusionadas desde la consola, o mediante \`firebase deploy --only firestore:rules\` únicamente cuando el archivo incluya todas las reglas necesarias para el proyecto.
5. Si Firebase Admin muestra un problema al generar tokens, revisar permisos de la cuenta de servicio de las funciones; puede requerir el rol Service Account Token Creator para firmar tokens.

**Advertencia de seguridad:** el PIN `5626` está escrito en el JavaScript público y en el código de Functions. Cualquier persona puede encontrarlo al consultar el repositorio. Por eso, el acceso local NO concede permiso sobre Firestore; solo las reglas y el servidor controlan los datos reales. Cambia a un secreto de servidor antes de usar información sensible en producción.

## Cómo configurar las carreras

1. Entrar a \`/administrador/\` con PIN después de desplegar Functions y reglas.
2. Entrar a «Carreras y enlaces».
3. Generar el enlace privado de cada carrera.
4. Copiar y entregar ese enlace al coordinador de la carrera, por un canal reservado.
5. Si se filtra o deja de ser válido, renovarlo o revocarlo desde el panel.

Quien posea un enlace tiene capacidad de actuar como coordinador de esa carrera. El sistema registra el **enlace de carrera** como actor, no la identidad personal del individuo que lo utiliza. Si necesitas identificar a cada docente individualmente, hará falta algún mecanismo de identificación adicional.

## Módulos disponibles

- Consulta de carreras, materias, PEA Base, unidades y actividades.
- Propuestas de cambios y comparación antes/después.
- Validación y aprobación administrativa que actualiza la versión oficial mediante transacción.
- Descarga de los tres PEA en Excel (ZIP) y anexo modificatorio en PDF.
- Estadísticas de carreras, asignaturas, solicitudes e historial.

## Publicación y pruebas

El flujo \`.github/workflows/pages.yml\` despliega la rama \`main\` en GitHub Pages y verifica sintaxis JS de \`assets/app.js\`. Las Cloud Functions no se despliegan en ese flujo porque requieren privilegios de un propietario de Firebase.

Se recomienda probar con una carrera de prueba antes de aprobar cambios sobre información curricular real. El respaldo curricular original no se importa ni se altera al instalar esta interfaz.
