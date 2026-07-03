# 🚀 Susurra · Deploy Instructions

Esta guía te lleva de **0 a landing pública en susurra.ai** en menos de 1 hora.

---

## ✅ Checklist Final Pre-Launch

Antes de hacer público el sitio, completá estos pasos:

### Datos personales en el código

Buscá y reemplazá estos placeholders en `index.html`:

| Placeholder actual | Reemplazar con |
|---|---|
| `[empresa real de tu mala experiencia]` | Una empresa específica o dejá "una empresa de Silicon Valley" |

> ✅ Los datos que ya tengo cargados:
> - Nombre: Luis Carranza Saldaña
> - Título: Ingeniero de Sistemas Computacionales
> - Stack: Flutter mobile
> - Ubicación: Perú
> - Años: 4
> - LinkedIn: https://www.linkedin.com/in/lucadevv
> - Email: luiscodecarranza@gmail.com
> - Empresa: "una empresa de Silicon Valley" (genérico, como pediste)

### Foto profesional

Actualmente la landing muestra un avatar elegante con tus iniciales "lc" sobre coral. **Esto funciona perfecto para lanzar**.

Cuando tengas foto profesional:
1. Subila a la carpeta como `founder.jpg` (o `.png`)
2. En `index.html` buscá `<div class="founder-photo">` y reemplazá el contenido por:
```html
<div class="founder-photo">
  <img src="founder.jpg" alt="Luis Carranza Saldaña" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">
</div>
```

### Formulario waitlist (importante)

**Actualmente**: el form usa `mailto:luiscodecarranza@gmail.com` como fallback. Funciona pero abre el cliente de email del usuario (no ideal).

**Recomendado**: reemplazar por Tally.

#### Cómo configurar Tally (10 minutos)

1. Andá a https://tally.so y creá cuenta gratis (con Google)
2. "Create a new form" → elegí plantilla "Waitlist"
3. Configurá estos campos:
   - **Email** (short text, required)
   - **Nombre** (short text, required)
   - **¿Para qué querés usar Susurra?** (dropdown):
     - Entrevistas de trabajo (inglés)
     - Entrevistas de trabajo (español)
     - Reuniones con cliente
     - Defensa de tesis / examen oral
     - Otra cosa
   - **¿Cuándo tenés tu próxima conversación importante?** (short text, opcional)
4. En "Sharing", elegí "Embed" → copiá el código `<iframe>`
5. En `index.html`, buscá `<!-- NOTA: este form mailto es temporal` y reemplazá toda la sección `<form>...</form>` por el iframe de Tally

---

## 🛒 Paso 1: Comprar el dominio (15 min)

### Opción recomendada: Cloudflare Registrar

1. Andá a https://www.cloudflare.com/products/registrar/
2. Buscá `susurra.ai`
3. Si está disponible: **comprar 2 años** (~$160 USD)
   - .ai requiere mínimo 2 años por reglas del TLD
   - Cloudflare cobra at-cost (sin markup)
4. Durante el setup:
   - ✅ Activá **WHOIS privacy** (gratis)
   - ✅ Configurá **DNSSEC** (gratis, te da más seguridad)
5. Una vez comprado, en el dashboard Cloudflare:
   - Andá a **Email** → **Email Routing**
   - Creá `hola@susurra.ai` → forwarding a `luiscodecarranza@gmail.com`
   - Verificá tu inbox

### Dominios defensivos (opcional, ~$50)

Si tenés presupuesto:
- `susurra.dev` en Cloudflare (~$15/año)
- `susurra.lat` en Porkbun (~$30/año)

---

## 📦 Paso 2: Setup del proyecto (10 min)

### Si tenés Git instalado

```bash
# Crear carpeta del proyecto
mkdir susurra-landing
cd susurra-landing

# Copiar los archivos de esta carpeta:
# - index.html
# - favicon.svg
# - og-image.svg
# (luego convertir og-image.svg a og-image.png con cualquier tool online o Figma)

# Inicializar git
git init
git add .
git commit -m "Initial commit"

# Crear repo en GitHub (público o privado, da igual)
# https://github.com/new → nombre: susurra-landing
git remote add origin https://github.com/TU_USUARIO/susurra-landing.git
git branch -M main
git push -u origin main
```

### Si no usás Git

No hay problema. Podés:
1. Hacer drag-and-drop directo en Vercel (próximo paso)
2. O subir manualmente a GitHub via web

---

## ☁️ Paso 3: Deploy a Vercel (10 min)

1. Andá a https://vercel.com → Sign up con GitHub (gratis)
2. **"Add New Project"** → Importá tu repo `susurra-landing`
3. Vercel detecta automáticamente que es HTML estático
4. Click **"Deploy"** → en 30 segundos tenés URL: `susurra-landing-xxx.vercel.app`
5. Verificá que se vea bien en mobile (abrílo en tu celu)

### Conectar el dominio susurra.ai

1. En Vercel dashboard → tu proyecto → **Settings** → **Domains**
2. Add domain: `susurra.ai` y `www.susurra.ai`
3. Vercel te da DNS records (tipo A y CNAME)
4. Andá a Cloudflare → DNS → agregá los records que te dio Vercel
5. Esperá 5-15 minutos para propagación
6. Volvé a Vercel → te confirma "Domain configured"

✅ **En este punto susurra.ai está online.**

---

## 🎯 Paso 4: Reservar handles sociales (15 min)

Importante hacerlo HOY para asegurar consistencia de marca.

Probá en este orden:

1. **TikTok**: https://www.tiktok.com/@susurra.app (si no, `@susurrahq`)
2. **Instagram**: https://www.instagram.com → registrate como `susurra.app` (si no, `susurrahq`)
3. **Twitter/X**: `@susurra.app` (si no, `@susurrahq`)
4. **LinkedIn**: Creá página de empresa "Susurra"
5. **GitHub**: Creá org `/susurra` (gratis)
6. **YouTube**: `@susurra.app` o `@susurrahq`
7. **ProductHunt**: Creá maker profile (para cuando lances)

**Regla clave**: el mismo handle en TODAS las plataformas. Si `@susurra.app` está tomado en una sola, cambiá a la siguiente opción **en todas**.

---

## 📊 Paso 5: Analytics y tracking (5 min)

### Vercel Analytics (gratis)

1. En Vercel → tu proyecto → **Analytics** tab
2. Click **"Enable"** → ya está
3. Vas a ver: visitas, países, devices, páginas más vistas

### Plausible (opcional, $9/mes pero gratis 30 días)

Mejor para tracking de conversiones:
1. https://plausible.io → crear cuenta
2. Agregar el sitio susurra.ai
3. Plausible te da un script. Agregalo justo antes de `</head>` en `index.html`:
```html
<script defer data-domain="susurra.ai" src="https://plausible.io/js/script.js"></script>
```

---

## ✅ Paso 6: Validación final (10 min)

Antes de empezar a compartir el link, verificá:

- [ ] El sitio carga en susurra.ai en menos de 2 segundos
- [ ] Se ve bien en mobile (probalo en tu celu)
- [ ] Los links de la nav funcionan (scroll a secciones)
- [ ] El formulario de waitlist envía correctamente (testealo con tu email)
- [ ] El favicon aparece en la pestaña del browser
- [ ] Al compartir el link en WhatsApp/Twitter, aparece el preview con OG image
  - Si NO aparece, revisar que `og-image.png` exista (convertir el SVG a PNG)
  - Para forzar refresh del preview en Twitter: https://cards-dev.twitter.com/validator

---

## 🚀 Paso 7: Lanzá

Una vez todo OK:

1. **Compartí en tu LinkedIn personal**: "Empecé a construir Susurra, un copilot AI para devs LATAM en conversaciones que importan. Beta cerrada por invitación: susurra.ai 🤫"
2. **Mandá a 5-10 devs cercanos** por WhatsApp directo:
   > "Loco, estoy lanzando Susurra (susurra.ai). Es un copilot AI que te susurra qué decir en entrevistas/reuniones. ¿Te tincaría probarlo en beta? Tu feedback me sumaría mucho."
3. **Postealo en comunidades LATAM**:
   - FrontendCafé (Discord)
   - r/devsarg, r/devsmexico, r/peruDeveloper
   - Comunidades de midudev, FaztTech
4. **Tweeteá**: el link + screenshot del producto

---

## 🆘 Si algo falla

| Problema | Solución |
|---|---|
| `susurra.ai` no carga después del deploy | Esperar 15-30 min para propagación DNS |
| El preview de WhatsApp/Twitter está vacío | Convertir `og-image.svg` a `og-image.png` (Figma o https://svg2png.com) |
| Formulario no funciona | Reemplazar mailto por embed de Tally |
| Foto no carga | Verificar que el archivo se llame `founder.jpg` y esté en raíz |
| Las fuentes no cargan | Verificar conexión a Google Fonts (es la única dependencia externa) |

---

## 🎯 Después del lanzamiento

**Día 1**: Compartí con tu red personal (5-10 mensajes directos)  
**Día 2-7**: 5 DMs por día a devs LATAM no conocidos  
**Día 8-14**: Empezás onboarding 1-a-1 con los primeros que respondieron  
**Día 15-30**: Iteración con feedback real + 20 usuarios reales en la beta  

📌 **Recordá**: este sitio es una herramienta, no el producto. Cada hora que pasés mejorándolo en lugar de hablando con usuarios es una hora perdida. Iterá con feedback real, no con suposiciones.

---

## 📞 Si necesitás ayuda

- Hosting/dominio issues → soporte Cloudflare/Vercel (ambos responden rápido)
- Code issues → revisar este código que está bien comentado
- Estrategia → volvé a esta conversación

¡Vamos! 🤫
