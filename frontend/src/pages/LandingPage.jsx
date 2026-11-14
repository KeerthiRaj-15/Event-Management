import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight, ArrowRight, Menu, X, Sparkles, CalendarDays,
  PartyPopper, Building2, Music2, Cake, Rocket, Heart, Play,
  Instagram, Linkedin, Mail, MoveUpRight
} from "lucide-react";
import "./LandingPage.css";

const services = [
  { icon: Heart, number: "01", title: "Weddings", copy: "Meaningful moments, beautifully orchestrated.", tone: "rose", image: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1000&q=85" },
  { icon: Building2, number: "02", title: "Corporate", copy: "Big ideas deserve unforgettable stages.", tone: "blue", image: "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1000&q=85" },
  { icon: Cake, number: "03", title: "Celebrations", copy: "The kind of party people talk about.", tone: "gold", image: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1000&q=85" },
  { icon: Music2, number: "04", title: "Live experiences", copy: "Bring the room to life. Then raise the roof.", tone: "violet", image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1000&q=85" },
  { icon: Rocket, number: "05", title: "Launches", copy: "Make your next big thing impossible to miss.", tone: "blue", image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1000&q=85" },
  { icon: PartyPopper, number: "06", title: "Private events", copy: "Intimate gatherings with extraordinary detail.", tone: "rose", image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1000&q=85" },
];

const featured = [
  { name: "A night in bloom", type: "WEDDING · BENGALURU", image: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1400&q=85", className: "wide" },
  { name: "Ideas after dark", type: "BRAND EXPERIENCE · MUMBAI", image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1000&q=85", className: "tall" },
  { name: "The next chapter", type: "CORPORATE · HYDERABAD", image: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1000&q=85", className: "small" },
];

function Intro({ onComplete }) {
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const root = document.querySelector(".gather-intro");
    if (!root) return undefined;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      const timer = window.setTimeout(() => onCompleteRef.current?.(), 180);
      return () => window.clearTimeout(timer);
    }
    const gsap = window.gsap;
    if (!gsap) {
      const timer = window.setTimeout(() => onCompleteRef.current?.(), 2600);
      return () => window.clearTimeout(timer);
    }
    root.classList.add("gsap-active");
    const wrap = root.querySelector(".intro-word-wrap");
    const word = root.querySelector(".intro-word");
    const letters = [...root.querySelectorAll(".intro-letter")];
    const balls = [...root.querySelectorAll(".drop-ball:not(.drop-final)")];
    const finalBall = root.querySelector(".drop-final");
    const period = root.querySelector(".intro-period");
    const shine = root.querySelector(".intro-shine");
    const wrapRect = wrap.getBoundingClientRect();
    const ballTargets = letters.map((letter) => {
      const rect = letter.getBoundingClientRect();
      return { x: rect.left - wrapRect.left + rect.width / 2, y: rect.top - wrapRect.top + Math.max(4, rect.height * 0.12) };
    });
    const periodRect = period.getBoundingClientRect();
    const finalTarget = { x: periodRect.left - wrapRect.left + periodRect.width / 2, y: periodRect.top - wrapRect.top + periodRect.height * 0.2 };
    gsap.set([...balls, finalBall], { left: 0, top: 0, xPercent: -50, yPercent: -50, x: -100, y: -window.innerHeight * 0.7, opacity: 1, scale: 1 });
    gsap.set(period, { opacity: 0, scale: 0.15, transformOrigin: "50% 70%" });
    gsap.set(shine, { xPercent: -140, opacity: 0 });
    const timeline = gsap.timeline({ defaults: { overwrite: "auto" } });
    balls.forEach((ball, index) => {
      const target = ballTargets[index];
      const letter = letters[index];
      timeline
        .set(ball, { x: target.x, y: -window.innerHeight * 0.7, scale: 1, opacity: 1 })
        .to(ball, { y: target.y - 5, duration: 0.18, ease: "power3.in" })
        .to(ball, { y: target.y, scaleX: 1.42, scaleY: 0.62, duration: 0.04, ease: "power1.in" })
        .to(ball, { y: target.y - 7, scaleX: 0.88, scaleY: 1.16, duration: 0.07, ease: "power2.out" })
        .to(ball, { y: target.y - 2, scale: 0.18, opacity: 0, duration: 0.04, ease: "power2.in" })
        .to(letter, { y: -13, scaleY: 1.2, scaleX: 0.92, duration: 0.05, ease: "power2.out" }, "<")
        .to(letter, { y: 0, scaleY: 0.94, scaleX: 1.04, duration: 0.08, ease: "power2.inOut" }, "<0.07")
        .to(letter, { scale: 1, duration: 0.07, ease: "elastic.out(1, 0.42)" }, "<0.08")
        .to(word, { y: -3, duration: 0.05, ease: "power2.out" }, "<")
        .to(word, { y: 0, duration: 0.09, ease: "bounce.out" }, "<0.06");
    });
    timeline
      .set(finalBall, { x: finalTarget.x, y: -window.innerHeight * 0.7, scale: 1, opacity: 1 })
      .to(finalBall, { y: finalTarget.y - 4, duration: 0.2, ease: "power3.in" })
      .to(finalBall, { y: finalTarget.y, scaleX: 1.45, scaleY: 0.62, duration: 0.08, ease: "power1.in" })
      .to(finalBall, { y: finalTarget.y - 5, scaleX: 0.9, scaleY: 1.12, duration: 0.07, ease: "power2.out" })
      .to(finalBall, { scale: 0.1, opacity: 0, duration: 0.04, ease: "power2.in" })
      .to(period, { opacity: 1, scale: 1.18, duration: 0.12, ease: "back.out(3)" }, "<")
      .to(period, { scale: 1, duration: 0.1, ease: "elastic.out(1, 0.35)" })
      .to(word, { filter: "brightness(1.7)", textShadow: "0 0 24px rgba(255,255,255,.55), 0 0 58px rgba(165,138,255,.95)", duration: 0.16 }, ">")
      .to(shine, { xPercent: 500, opacity: 1, duration: 0.32, ease: "power2.inOut" }, "<")
      .to(shine, { opacity: 0, duration: 0.12 }, ">-0.06")
      .to(word, { filter: "brightness(1)", duration: 0.16 }, "<")
      .to({}, { duration: 0.08 })
      .to(root, { opacity: 0, duration: 0.22, ease: "power2.inOut", onComplete: () => onCompleteRef.current?.() });
    return () => timeline.kill();
  }, []);

  return (
    <div className="gather-intro" aria-label="Gather intro animation">
      <div className="intro-grain" />
      <div className="intro-orbit orbit-one" /><div className="intro-orbit orbit-two" />
      <div className="intro-word-wrap">
        <div className="intro-word" aria-label="Gather">
          {[..."Gather"].map((letter, index) => <span className={`intro-letter letter-${index}`} key={`${letter}-${index}`}>{letter}</span>)}
          <span className="intro-period-space" />
        </div>
        <span className="intro-shine" aria-hidden="true" />
        {[..."Gather"].map((letter, index) => <span key={index} className={`drop-ball drop-${index}`} aria-hidden="true" />)}
        <span className="drop-ball drop-final" aria-hidden="true" />
        <span className="intro-period" aria-hidden="true">.</span>
      </div>
      <div className="intro-bottom"><span>EXPERIENCES, THOUGHTFULLY MADE</span><span>EST. FOR THE EXTRAORDINARY</span></div>
      <div className="intro-progress"><span /></div>
    </div>
  );
}

function StageScene() {
  const sceneRef = useRef(null);
  useEffect(() => {
    const THREE = window.THREE;
    const host = sceneRef.current;
    if (!THREE || !host) return undefined;
    let renderer;
    let frame;
    let observer;
    let pointerHandler;
    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 2.6, 9.5);
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.className = "stage-three-canvas";
      host.prepend(renderer.domElement);
      scene.add(new THREE.AmbientLight(0xb9a7ff, 1.5));
      const key = new THREE.PointLight(0xc7a9ff, 75, 18); key.position.set(-3, 5, 4); scene.add(key);
      const gold = new THREE.PointLight(0xd6b879, 45, 16); gold.position.set(4, 2, -2); scene.add(gold);
      const stageMaterial = new THREE.MeshStandardMaterial({ color: 0x302743, metalness: .82, roughness: .28, emissive: 0x211533, emissiveIntensity: .5 });
      const platform = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.45, .22, 96), stageMaterial);
      platform.position.y = -1.15; platform.rotation.x = -.04; scene.add(platform);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.7, .16, 96), new THREE.MeshStandardMaterial({ color: 0x8f76bf, metalness: .9, roughness: .2, emissive: 0x39265c, emissiveIntensity: .7 }));
      top.position.y = -.95; scene.add(top);
      const rings = [];
      [2.2, 2.75, 3.35].forEach((radius, i) => {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, .018, 12, 120), new THREE.MeshStandardMaterial({ color: i === 1 ? 0xd6b879 : 0xbca5ff, metalness: .9, roughness: .2, emissive: i === 1 ? 0x735b2d : 0x55408a, emissiveIntensity: .65 }));
        ring.rotation.x = Math.PI / 2.7 + i * .06; ring.rotation.z = i * .8; ring.position.y = -.55 + i * .28; scene.add(ring); rings.push(ring);
      });
      const orbGeometry = new THREE.SphereGeometry(.075, 24, 24);
      const orbs = [];
      for (let i = 0; i < 34; i++) {
        const orb = new THREE.Mesh(orbGeometry, new THREE.MeshStandardMaterial({ color: i % 5 === 0 ? 0xe5cc91 : 0xc9b8ff, emissive: i % 5 === 0 ? 0x9a7438 : 0x7255c7, emissiveIntensity: 1.8, metalness: .6, roughness: .22 }));
        const angle = (i / 34) * Math.PI * 2;
        const radius = 2.1 + (i % 4) * .48;
        orb.position.set(Math.cos(angle) * radius, -0.1 + Math.sin(i * 3.7) * 1.35, Math.sin(angle) * radius);
        scene.add(orb); orbs.push(orb);
      }
      const spotlights = [];
      [-2.8, 2.8].forEach((x, i) => {
        const light = new THREE.SpotLight(i ? 0xd6b879 : 0xa58aff, 55, 15, .32, .7, 1.2);
        light.position.set(x, 5, 2); light.target.position.set(0, -1, 0); scene.add(light, light.target); spotlights.push(light);
      });
      const resize = () => { const w = host.clientWidth || 1; const h = host.clientHeight || 1; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); };
      observer = new ResizeObserver(resize); observer.observe(host);
      const clock = new THREE.Clock();
      const pointer = { x: 0, y: 0 };
      const onPointerMove = (event) => {
        const bounds = host.getBoundingClientRect();
        pointer.x = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 2;
        pointer.y = ((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 2;
      };
      pointerHandler = onPointerMove;
      host.addEventListener("pointermove", onPointerMove, { passive: true });
      const animate = () => {
        const t = clock.getElapsedTime();
        rings.forEach((ring, i) => { ring.rotation.z += (i % 2 ? -1 : 1) * .0018; ring.position.y = -.55 + i * .28 + Math.sin(t * .7 + i) * .05; });
        orbs.forEach((orb, i) => { orb.position.y += Math.sin(t * 1.2 + i) * .0009; });
        spotlights.forEach((light, i) => { light.position.x = Math.sin(t * .38 + i * Math.PI) * 3.8; light.position.z = Math.cos(t * .32 + i) * 3.2; });
        camera.position.x += (pointer.x * .42 + Math.sin(t * .12) * .12 - camera.position.x) * .025;
        camera.position.y += (2.6 - pointer.y * .22 - camera.position.y) * .025;
        camera.lookAt(pointer.x * .16, -.25 - pointer.y * .1, 0);
        renderer.render(scene, camera); frame = requestAnimationFrame(animate);
      };
      animate();
    } catch (error) { console.warn("3D stage unavailable; using CSS stage fallback.", error); }
    return () => { host?.removeEventListener("pointermove", pointerHandler); cancelAnimationFrame(frame); observer?.disconnect(); renderer?.dispose(); renderer?.domElement?.remove(); };
  }, []);
  return (
    <div className="stage-scene" ref={sceneRef} aria-hidden="true">
      <div className="stage-grid" />
      <div className="stage-halo halo-a" /><div className="stage-halo halo-b" />
      <div className="stage-ring ring-a" /><div className="stage-ring ring-b" /><div className="stage-ring ring-c" />
      <div className="stage-platform platform-back" /><div className="stage-platform platform-mid" /><div className="stage-platform platform-front" />
      <div className="stage-pillar pillar-one" /><div className="stage-pillar pillar-two" /><div className="stage-pillar pillar-three" />
      <div className="stage-beam beam-one" /><div className="stage-beam beam-two" /><div className="stage-beam beam-three" />
      <div className="stage-orb orb-one" /><div className="stage-orb orb-two" /><div className="stage-orb orb-three" />
      <div className="stage-reflection" />
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const showIntro = true;
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [formSent, setFormSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", eventType: "Wedding", date: "", guests: "", message: "" });
  const heroRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 36);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (showIntro) return undefined;
    const nodes = document.querySelectorAll("[data-reveal]");
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); }
    }), { threshold: 0.14 });
    nodes.forEach((node) => observer.observe(node));

    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    let context;
    if (gsap && ScrollTrigger && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      gsap.registerPlugin(ScrollTrigger);
      context = gsap.context(() => {
        gsap.from(".hero-copy > *", {
          y: 26, opacity: 0, duration: 0.8, stagger: 0.11, ease: "power3.out",
          delay: 0.08,
        });
        gsap.to(".hero-visual", {
          yPercent: 10, ease: "none",
          scrollTrigger: { trigger: ".gather-hero", start: "top top", end: "bottom top", scrub: 0.8 },
        });
        [".service-grid", ".work-grid", ".process-list"].forEach((selector) => {
          const section = document.querySelector(selector);
          if (!section) return;
          gsap.from(section.children, {
            y: 34, opacity: 0, duration: 0.75, stagger: 0.1, ease: "power3.out",
            scrollTrigger: { trigger: section, start: "top 82%", once: true },
          });
        });
      });
    }
    return () => { observer.disconnect(); context?.revert(); };
  }, [showIntro]);

  const closeMenu = () => setMenuOpen(false);
  const submitBrief = (event) => {
    event.preventDefault();
    const subject = encodeURIComponent(`Event enquiry — ${form.eventType}`);
    const body = encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\nEvent type: ${form.eventType}\nDate: ${form.date}\nGuests: ${form.guests}\nDetails: ${form.message}`);
    window.location.href = `mailto:hello@gather.events?subject=${subject}&body=${body}`;
    setFormSent(true);
  };

  return (
    <div className="gather-site">
      {showIntro && <Intro onComplete={() => navigate("/register", { replace: true })} />}
      <header className={`gather-nav ${scrolled ? "nav-scrolled" : ""}`}>
        <a className="gather-logo" href="#home" onClick={closeMenu}>gather<span>.</span></a>
        <nav className={menuOpen ? "nav-open" : ""}>
          <a href="#about" onClick={closeMenu}>Our story</a><a href="#services" onClick={closeMenu}>What we do</a><a href="#work" onClick={closeMenu}>Selected work</a><a href="#process" onClick={closeMenu}>Our approach</a>
          <Link className="nav-mobile-cta" to="/register" onClick={closeMenu}>Start planning <ArrowUpRight size={16} /></Link>
        </nav>
        <Link className="nav-cta" to="/register">Plan your event <ArrowUpRight size={16} /></Link>
        <button className="nav-menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"}>{menuOpen ? <X /> : <Menu />}</button>
      </header>

      <main>
        <section className="gather-hero" id="home" ref={heroRef}>
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> THE ART OF BRINGING PEOPLE TOGETHER</div>
            <h1>Make room<br />for <em>the</em> <span>moment.</span></h1>
            <p className="hero-subtitle">We turn your biggest ideas into the moments everyone remembers. Thoughtful planning. Imaginative design. Flawless execution.</p>
            <div className="hero-actions"><a href="#work" className="button-primary">Explore our work <ArrowUpRight size={17} /></a><a href="#about" className="button-text"><span className="play-icon"><Play size={12} fill="currentColor" /></span> Discover Gather</a></div>
            <div className="hero-proof"><div className="proof-avatars"><i>G</i><i>+</i><i>Y</i></div><span>Good people. Great gatherings.<br /><b>Extraordinary by design.</b></span></div>
          </div>
          <div className="hero-visual"><StageScene /><div className="visual-label label-top"><span>01 / 04</span><span>THE GATHER EXPERIENCE</span></div><div className="visual-label label-bottom"><span>CREATING THE UNEXPECTED</span><span className="label-dot" /></div><div className="hero-side-note">IDEAS INTO EXPERIENCES — SINCE ALWAYS</div></div>
          <a className="scroll-cue" href="#about"><span /> SCROLL TO EXPLORE</a>
          <div className="hero-index">01 <i /> 05</div>
        </section>

        <section className="intro-statement" id="about">
          <div className="section-kicker" data-reveal>01 — A LITTLE ABOUT US</div>
          <div className="statement-content" data-reveal><p>Some moments deserve <span>more than a venue.</span> They deserve a feeling. We bring the right people, details and ideas together to make it happen.</p><Link to="/register" className="round-link" aria-label="Start a conversation"><ArrowUpRight /></Link></div>
          <div className="statement-foot" data-reveal><span>WE ARE GATHER.</span><span>CREATIVE MINDS. CALM HANDS. BIG FEELINGS.</span></div>
        </section>

        <section className="services-section" id="services">
          <div className="section-head" data-reveal><div><div className="section-kicker">02 — WHAT WE DO</div><h2>Every occasion.<br /><em>Its own kind</em> of magic.</h2></div><p>From the first sketch to the final encore, we make every moving part feel effortless.</p></div>
          <div className="service-grid">{services.map(({ icon: Icon, number, title, copy, tone, image }) => <article className={`service-card ${tone}`} key={number} data-reveal><div className="service-image" style={{ backgroundImage: `url(${image})` }} /><div className="service-shade" /><div className="service-top"><span>{number} / 06</span><Icon size={20} /></div><div className="service-info"><h3>{title}</h3><p>{copy}</p><span className="service-arrow"><ArrowUpRight size={18} /></span></div></article>)}</div>
        </section>

        <section className="work-section" id="work">
          <div className="section-head work-head" data-reveal><div><div className="section-kicker">03 — SELECTED MOMENTS</div><h2>Made to be<br /><em>remembered.</em></h2></div><p>A glimpse at the gatherings, big and small, that stay with us long after the lights go down.</p></div>
          <div className="work-grid">{featured.map((item, index) => <article className={`work-card ${item.className}`} key={item.name} data-reveal><img src={item.image} alt={item.name} loading="lazy" /><div className="work-overlay" /><div className="work-meta"><span>{item.type}</span><h3>{item.name}</h3></div><span className="work-number">0{index + 1}</span></article>)}</div>
          <div className="work-bottom"><span>EVERY EVENT HAS A STORY. LET'S MAKE YOURS.</span><Link to="/discover">Discover events <ArrowUpRight size={16} /></Link></div>
        </section>

        <section className="numbers-section">
          <div className="numbers-heading" data-reveal><div className="section-kicker">04 — THE GATHER DIFFERENCE</div><h2>Good things happen<br />when it <em>comes together.</em></h2></div>
          <div className="numbers-grid"><div data-reveal><strong>500<span>+</span></strong><small>EVENTS BROUGHT TO LIFE</small></div><div data-reveal><strong>200<span>+</span></strong><small>HAPPY CLIENTS & PARTNERS</small></div><div data-reveal><strong>10<span>+</span></strong><small>YEARS MAKING MOMENTS</small></div></div>
        </section>

        <section className="process-section" id="process">
          <div className="section-head" data-reveal><div><div className="section-kicker">05 — HOW WE MAKE IT HAPPEN</div><h2>Clear heads.<br /><em>Beautiful details.</em></h2></div><p>Big events feel effortless when every detail has a place. Here's how we get there, together.</p></div>
          <div className="process-list">{[{ n: "01", t: "Listen", d: "We start with your vision, your people and what matters most." }, { n: "02", t: "Imagine", d: "We shape the concept, mood and details into one clear direction." }, { n: "03", t: "Make", d: "Our team brings every supplier, schedule and detail together." }, { n: "04", t: "Gather", d: "You enjoy the moment. We take care of everything behind it." }].map((step) => <div className="process-step" key={step.n} data-reveal><span>{step.n}</span><h3>{step.t}</h3><p>{step.d}</p><ArrowUpRight size={19} /></div>)}</div>
        </section>

        <section className="quote-section" data-reveal><div className="quote-mark">“</div><blockquote>It's not just about what people see. It's about what they <em>feel.</em></blockquote><div className="quote-caption"><span /> THE GATHER POINT OF VIEW</div></section>

        <section className="contact-section" id="contact">
          <div className="contact-copy" data-reveal><div className="section-kicker">06 — YOUR TURN</div><h2>Have a moment<br />in <em>mind?</em></h2><p>Tell us a little about it. We'll bring the ideas, the details and the calm confidence to make it real.</p><a href="mailto:hello@gather.events" className="contact-email">hello@gather.events <ArrowUpRight size={17} /></a></div>
          <form className="contact-form" onSubmit={submitBrief} data-reveal><div className="form-heading"><span>LET'S START WITH THE BASICS</span><Sparkles size={17} /></div><div className="form-row"><label>Your name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="What should we call you?" /></label><label>Email address<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label></div><div className="form-row"><label>What are we planning?<select value={form.eventType} onChange={e => setForm({ ...form, eventType: e.target.value })}><option>Wedding</option><option>Corporate event</option><option>Birthday / Celebration</option><option>Concert / Festival</option><option>Product launch</option><option>Private event</option></select></label><label>When is the big day?<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label></div><div className="form-row"><label>Expected guests<input value={form.guests} onChange={e => setForm({ ...form, guests: e.target.value })} placeholder="A rough number is fine" /></label><label className="message-label">A little more about it<textarea rows="2" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="The vision, the feeling, the details..." /></label></div><button type="submit" className="button-primary form-submit">{formSent ? "Email draft opened" : "Let's plan your event"} <ArrowUpRight size={17} /></button><small className="form-note">Your details open in your email app so you can send your enquiry directly.</small></form>
        </section>
      </main>

      <footer className="gather-footer"><a className="gather-logo" href="#home">gather<span>.</span></a><p>Bringing good people<br />together, beautifully.</p><div className="footer-links"><a href="#services">Services</a><a href="#work">Our work</a><a href="#contact">Contact</a><Link to="/login">Sign in</Link><Link to="/register">Create account</Link></div><div className="footer-social"><a href="https://instagram.com" aria-label="Instagram"><Instagram size={17} /></a><a href="https://linkedin.com" aria-label="LinkedIn"><Linkedin size={17} /></a><a href="mailto:hello@gather.events" aria-label="Email"><Mail size={17} /></a></div><div className="footer-bottom"><span>© 2026 GATHER. MADE FOR THE MOMENT.</span><a href="#home">BACK TO TOP ↑</a></div></footer>
    </div>
  );
}
