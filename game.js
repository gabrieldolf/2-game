const SCREEN_WIDTH = 1024, SCREEN_HEIGHT = 768, WORLD_WIDTH = 3000, WORLD_HEIGHT = 2000;
let player1, player2, ferramentaAtual = 'create', objetoSelecionado = null, listaObjetosEditaveis = [];
let gridGraphics, bordasFixasDoCenario = [], cursorsKeyboard;
let modoEditorAtivo = false, cameraSalvaX = 0, cameraSalvaY = 0, cameraSalvaZoom = 1;
let clickOffsetX = 0, clickOffsetY = 0;
let verticesCriacaoAtiva = [], previewGraphicsPoligono = null;

const config = {
    type: Phaser.AUTO, width: SCREEN_WIDTH, height: SCREEN_HEIGHT, parent: 'canvas-container', backgroundColor: '#4488aa',
    physics: { 
        default: 'matter', 
        matter: { 
            gravity: { y:1.5 }, debug: true,
            runner: { constraintIterations: 12, positionIterations: 12, velocityIterations: 10 }
        } 
    },
    input: { gamepad: true }, scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

function desmarcarObjetoDoEditor() { objetoSelecionado = null; document.getElementById('btn-delete').style.display = 'none'; clickOffsetX = 0; clickOffsetY = 0; }
function setFerramenta(f) { ferramentaAtual = f; document.getElementById('btn-create').className = f==='create'?'active':''; document.getElementById('btn-select').className = f==='select'?'active':''; }

function alternarModoEditor(scene) {
    modoEditorAtivo = !modoEditorAtivo;
    const panel = document.getElementById('sidebar');
    const aviso = document.getElementById('aviso-modo');
    verticesCriacaoAtiva = []; 
    if (previewGraphicsPoligono) previewGraphicsPoligono.clear();
    
    if (modoEditorAtivo) {
        cameraSalvaX = scene.cameras.main.scrollX; cameraSalvaY = scene.cameras.main.scrollY; cameraSalvaZoom = scene.cameras.main.zoom;
        scene.cameras.main.setZoom(1.0); scene.matter.world.pause();
        panel.style.display = 'flex'; aviso.innerText = "Modo Editor Ativo - Aperte [E] para Jogar"; aviso.style.color = "#00ff00";
    } else {
        desmarcarObjetoDoEditor(); scene.cameras.main.scrollX = cameraSalvaX; scene.cameras.main.scrollY = cameraSalvaY; scene.cameras.main.setZoom(cameraSalvaZoom);
        scene.matter.world.resume(); panel.style.display = 'none'; aviso.innerText = "Aperte [E] para abrir o Editor"; aviso.style.color = "#fff";
    }
    alternarVisibilidadeGrade();
}

function alternarVisibilidadeGrade() {
    gridGraphics.clear(); if (!modoEditorAtivo || !document.getElementById('prop-grid-active').checked) return;
    const gSize = parseInt(document.getElementById('prop-grid-size').value) || 64; gridGraphics.lineStyle(1, 0xffffff, 0.15);
    for (let x = 0; x < WORLD_WIDTH; x += gSize) gridGraphics.lineBetween(x, 0, x, WORLD_HEIGHT);
    for (let y = 0; y < WORLD_HEIGHT; y += gSize) gridGraphics.lineBetween(0, y, WORLD_WIDTH, y);
}

function preload() {}

function create() {
    if (this.input.gamepad) { this.input.gamepad.start(); }
    this.matter.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 100, true, true, true, true);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    gridGraphics = this.add.graphics().setDepth(1);
    previewGraphicsPoligono = this.add.graphics().setDepth(15);
    cursorsKeyboard = this.input.keyboard.createCursorKeys();

    // Spawna o Player 1 por padrão para a câmera ter um alvo de início
    player1 = createHeaveHoCharacter(this, 300, WORLD_HEIGHT - 150, null, 0, 0x00ff00);
    
    this.matter.world.on('afterupdate', () => {
        if (modoEditorAtivo) return;
        listaObjetosEditaveis.forEach(obj => {
            if (!obj || !obj.body || obj.body.isStatic) return;

            if (obj.maxVel && obj.maxVel > 0) {
                let velX = obj.body.velocity.x, velY = obj.body.velocity.y;
                let velCombinada = Math.sqrt(velX * velX + velY * velY);
                if (velCombinada > obj.maxVel && velCombinada > 0) {
                    this.matter.body.setVelocity(obj.body, { x: (velX / velCombinada) * obj.maxVel, y: (velY / velCombinada) * obj.maxVel });
                }
            }

            if (obj.maxRot && obj.maxRot > 0) {
                let velGiro = obj.body.angularVelocity;
                if (Math.abs(velGiro) > obj.maxRot) {
                    this.matter.body.setAngularVelocity(obj.body, obj.maxRot * Math.sign(velGiro));
                }
            }
        });
    });

    const ambConf = { isStatic:true, label:'ambiente', friction:0.8, restitution:0.1, collisionFilter: { category: CAT_AMBIENTE, mask: CAT_PLAYER | CAT_AMBIENTE } };
    const borda = (s, x, y, w, h) => {
        let b = s.matter.add.rectangle(x, y, w, h, ambConf); 
        b.isStaticBorder = true; b.manuseavel = false; b.naoAgarravel = false; b.label = 'ambiente'; bordasFixasDoCenario.push(b);
        s.add.graphics().fillStyle(0x1a1a1a, 1).fillRect(x - w/2, y - h/2, w, h).setDepth(2);
    };
    borda(this, WORLD_WIDTH/2, WORLD_HEIGHT-25, WORLD_WIDTH, 50); borda(this, WORLD_WIDTH/2, 25, WORLD_WIDTH, 50);
    borda(this, 25, WORLD_HEIGHT/2, 50, WORLD_HEIGHT); borda(this, WORLD_WIDTH-25, WORLD_HEIGHT/2, 50, WORLD_HEIGHT);
    
    this.matter.world.on('collisionstart', (e) => { e.pairs.forEach(p => { processarToqueParaContato(p.bodyA, p.bodyB, p); processarToqueParaContato(p.bodyB, p.bodyA, p); }); });
    this.matter.world.on('collisionactive', (e) => { e.pairs.forEach(p => { processarToqueParaContato(p.bodyA, p.bodyB, p); processarToqueParaContato(p.bodyB, p.bodyA, p); }); });
    this.matter.world.on('collisionend', (e) => { e.pairs.forEach(p => { quebrarToqueParaContato(p.bodyA, p.bodyB); quebrarToqueParaContato(p.bodyB, p.bodyA); }); });
    
    this.input.on('pointerdown', (p) => {
        if (!modoEditorAtivo) return;
        if (document.getElementById('prop-shape').value === 'polygon') {
            verticesCriacaoAtiva.push({ x: p.worldX, y: p.worldY });
            if (!this.listaBolinhasGuiaCena) this.listaBolinhasGuiaCena = [];
            if (!previewGraphicsPoligono) previewGraphicsPoligono = this.add.graphics().setDepth(9999);
            
            let bolaVisual = this.add.circle(p.worldX, p.worldY, 7, 0xff0000).setStrokeStyle(2, 0xffffff).setDepth(9999);
            this.listaBolinhasGuiaCena.push(bolaVisual);
        } else if (ferramentaAtual === 'create') {
            executarCriacaoObjeto(this, p.worldX, p.worldY);
        } else {
            executarSelecaoObjeto(this, p.worldX, p.worldY, p);
        }
    });

    this.input.on('pointermove', function(p) {
        if (modoEditorAtivo && ferramentaAtual === 'select' && objetoSelecionado && p.isDown) {
            let pos = { x: p.worldX - clickOffsetX, y: p.worldY - clickOffsetY };
            if (document.getElementById('prop-snap-active').checked && objetoSelecionado.shape !== 'polygon' && objetoSelecionado.shape !== 'rope') pos = calcularAlinhamentoPorProximidade(this, pos.x, pos.y, objetoSelecionado.w, objetoSelecionado.h, objetoSelecionado.shape, objetoSelecionado.body);
            if (objetoSelecionado.body) { this.matter.body.setPosition(objetoSelecionado.body, { x: pos.x, y: pos.y }); this.matter.body.setVelocity(objetoSelecionado.body, { x:0, y:0 }); }
            else { 
                objetoSelecionado.visualX = pos.x; objetoSelecionado.visualY = pos.y; 
                if (objetoSelecionado.shape === 'rope' && objetoSelecionado.ropeElos) {
                    let dx = pos.x - objetoSelecionado.posicaoTravadaX, dy = pos.y - objetoSelecionado.posicaoTravadaY;
                    objetoSelecionado.ropeElos.forEach(elo => { this.matter.body.setPosition(elo, { x: elo.position.x + dx, y: elo.position.y + dy }); this.matter.body.setVelocity(elo, { x:0, y:0 }); });
                }
            }
            objetoSelecionado.posicaoTravadaX = pos.x; objetoSelecionado.posicaoTravadaY = pos.y;
        }
    }, this);

    this.input.keyboard.on('keydown-E', () => { alternarModoEditor(this); });
    this.input.keyboard.on('keydown-ENTER', () => { if (modoEditorAtivo && ferramentaAtual === 'create' && document.getElementById('prop-shape').value === 'polygon') finalizarCriacaoPoligono(this); });
    
    this.input.gamepad.on('down', (pad) => {
        if (pad.index === 0 && player1) player1.pad = pad;
        if (pad.index === 1 && !player2) player2 = createHeaveHoCharacter(this, 500, WORLD_HEIGHT-150, pad, 1, 0xffff00);
    });
    atualizarInterfaceForma();
}

function atualizarInterfaceForma() {
    const s = document.getElementById('prop-shape').value;
    document.getElementById('painel-propriedades-comuns').style.display = (s === 'rope') ? 'none' : 'block';
    document.getElementById('painel-propriedades-corda').style.display = (s === 'rope') ? 'flex' : 'none';
    document.getElementById('row-h').style.display = (s === 'circle' || s === 'polygon' || s === 'rope') ? 'none' : 'flex';
    document.getElementById('row-w').style.display = (s === 'polygon' || s === 'rope') ? 'none' : 'flex';
    document.getElementById('label-w').innerText = s === 'circle' ? "Raio (px):" : "Largura (px):";
}

function extrairCamposPainel() {
    return {
        shape: document.getElementById('prop-shape').value, manuseavel: document.getElementById('prop-manuseavel').checked, lockGrab: document.getElementById('prop-lock-grab').checked, isStatic: document.getElementById('prop-is-static').checked,
        w: parseFloat(document.getElementById('prop-w').value) || 50, h: parseFloat(document.getElementById('prop-h').value) || 50,
        gravity: document.getElementById('prop-gravity').checked, lockPos: document.getElementById('prop-lock-pos').checked, lockRot: document.getElementById('prop-lock-rot').checked,
        mass: parseFloat(document.getElementById('prop-mass').value) || 1, air: parseFloat(document.getElementById('prop-air').value) || 0.02, bounce: parseFloat(document.getElementById('prop-bounce').value) || 0,
        ropeLen: parseFloat(document.getElementById('prop-rope-len').value) || 250, ropeSegments: parseInt(document.getElementById('prop-rope-segments').value) || 8, ropeColor: document.getElementById('prop-rope-color').value,
        maxVel: parseFloat(document.getElementById('prop-max-vel').value) || 0, maxRot: parseFloat(document.getElementById('prop-max-rot').value) || 0
    };
}

function executarCriacaoObjeto(scene, x, y) {
    let ax = x, ay = y; const c = extrairCamposPainel();
    if (c.shape === 'rope') {
        let elos = [], constraints = []; let segmentLen = c.ropeLen / c.ropeSegments; let lastBody = null;
        for (let i = 0; i < c.ropeSegments; i++) {
            let elo = scene.matter.add.rectangle(ax, ay + (i * segmentLen) + segmentLen/2, 12, segmentLen, { 
                isStatic: false, isSensor: false, mass: 0.8, frictionAir: 0.08, label: 'corpo_elo', collisionFilter: { category: 0x0002, mask: 0 } 
            });
            elo.manuseavel = false; elo.naoAgarravel = false; elos.push(elo);
            if (i === 0) constraints.push(scene.matter.add.worldConstraint(elo, 0, 0.15, { pointA: { x: ax, y: ay }, pointB: { x: 0, y: -segmentLen/2 }, damping: 0.2 }));
            else constraints.push(scene.matter.add.constraint(lastBody, elo, 0, 0.15, { pointA: { x: 0, y: segmentLen/2 }, pointB: { x: 0, y: -segmentLen/2 }, damping: 0.2 }));
            lastBody = elo;
        }
        listaObjetosEditaveis.push({ body: null, ropeElos: elos, ropeConstraints: constraints, shape: c.shape, w: c.w, h: c.h, gravity: c.gravity, lockPos: c.lockPos, lockRot: c.lockRot, mass: c.mass, air: c.air, bounce: c.bounce, maxVel: c.maxVel, maxRot: c.maxRot, ropeLen: c.ropeLen, ropeSegments: c.ropeSegments, ropeColor: c.ropeColor, gfx: scene.add.graphics().setDepth(3), posicaoTravadaX: ax, posicaoTravadaY: ay, visualX: ax, visualY: ay, manuseavel: false, naoAgarravel: false, isStatic: true });
        return;
    }
    let conf = { isStatic: c.isStatic, label: 'ambiente', ignoreGravity: !c.gravity, mass: c.mass, friction: 0.8, frictionAir: c.air, restitution: c.bounce, collisionFilter: { category: CAT_AMBIENTE, mask: CAT_PLAYER | CAT_AMBIENTE } };
    let body = (c.shape === 'box') ? scene.matter.add.rectangle(ax, ay, c.w, c.h, conf) : scene.matter.add.circle(ax, ay, c.w, conf);
    body.manuseavel = c.manuseavel; body.naoAgarravel = c.lockGrab; body.label = 'ambiente';
    if (!body.isStatic) { scene.matter.body.setInertia(body, c.lockRot ? Infinity : body.inertia); }
    listaObjetosEditaveis.push({ body: body, gfx: scene.add.graphics().setDepth(3), shape: c.shape, w: c.w, h: c.h, gravity: c.gravity, lockPos: c.lockPos, lockRot: c.lockRot, mass: c.mass, air: c.air, bounce: c.bounce, maxVel: c.maxVel, maxRot: c.maxRot, posicaoTravadaX: ax, posicaoTravadaY: ay, physicsActive: true, visualX: ax, visualY: ay, dadosDesenhoVisual: null, manuseavel: c.manuseavel, naoAgarravel: c.lockGrab, isStatic: c.isStatic });
}

function limparBolinhasGuiaDoPoligono(scene) {
    if (previewGraphicsPoligono) { previewGraphicsPoligono.clear(); }
    if (scene && scene.listaBolinhasGuiaCena) {
        scene.listaBolinhasGuiaCena.forEach(bola => { if (bola && bola.destroy) bola.destroy(); });
        scene.listaBolinhasGuiaCena = [];
    }
}

function finalizarCriacaoPoligono(scene) {
    if (verticesCriacaoAtiva.length < 3) { alert("Polígonos precisam de pelo menos 3 vértices!"); return; }
    const c = extrairCamposPainel();
    let somatorioX = 0, somatorioY = 0; verticesCriacaoAtiva.forEach(v => { somatorioX += v.x; somatorioY += v.y; });
    let centroX = somatorioX / verticesCriacaoAtiva.length; let centroY = somatorioY / verticesCriacaoAtiva.length;
    let conf = { isStatic: c.isStatic, label: 'ambiente', ignoreGravity: !c.gravity, mass: c.manuseavel ? (c.mass / verticesCriacaoAtiva.length) : c.mass, friction: 0.8, frictionAir: c.air, restitution: c.bounce, collisionFilter: { category: CAT_AMBIENTE, mask: CAT_PLAYER | CAT_AMBIENTE } };
    let partesFisicasTriangulares = [];
    for (let i = 0; i < verticesCriacaoAtiva.length; i++) {
        let p1 = verticesCriacaoAtiva[i]; let p2 = verticesCriacaoAtiva[(i + 1) % verticesCriacaoAtiva.length];
        let trianguloVertices = [{ x: centroX, y: centroY }, { x: p1.x, y: p1.y }, { x: p2.x, y: p2.y }];
        let corpoFatiaPuro = Phaser.Physics.Matter.Matter.Bodies.fromVertices((centroX + p1.x + p2.x)/3, (centroY + p1.y + p2.y)/3, trianguloVertices, conf);
        if (corpoFatiaPuro) partesFisicasTriangulares.push(corpoFatiaPuro);
    }
    let body = scene.matter.body.create({ parts: partesFisicasTriangulares, isStatic: c.isStatic, label: 'ambiente', ignoreGravity: !c.gravity });
    body.manuseavel = c.manuseavel; body.naoAgarravel = c.lockGrab;
    scene.matter.world.add(body); scene.matter.body.setPosition(body, { x: centroX, y: centroY });
    if (!body.isStatic) { scene.matter.body.setInertia(body, c.lockRot ? Infinity : body.inertia); }
    let verticesLocaisRelativos = verticesCriacaoAtiva.map(v => { return { x: v.x - centroX, y: v.y - centroY }; });
    listaObjetosEditaveis.push({ body: body, gfx: scene.add.graphics().setDepth(3), shape: 'polygon', w: 0, h: 0, gravity: c.gravity, lockPos: c.lockPos, lockRot: c.lockRot, mass: c.mass, air: c.air, bounce: c.bounce, maxVel: c.maxVel, maxRot: c.maxRot, posicaoTravadaX: centroX, posicaoTravadaY: centroY, physicsActive: true, visualX: centroX, visualY: centroY, dadosDesenhoVisual: verticesLocaisRelativos, manuseavel: c.manuseavel, naoAgarravel: c.lockGrab, isStatic: c.isStatic });
    
    verticesCriacaoAtiva = []; 
    limparBolinhasGuiaDoPoligono(scene);
}

function executarSelecaoObjeto(scene, x, y, pointer) {
    let prox = null, mDist = Infinity;
    listaObjetosEditaveis.forEach(obj => {
        let colidiu = false;
        if (obj.body) colidiu = Phaser.Physics.Matter.Matter.Vertices.contains(obj.body.vertices, { x: x, y: y });
        else if (obj.shape === 'rope' && obj.ropeElos) { obj.ropeElos.forEach(elo => { if (Phaser.Physics.Matter.Matter.Vertices.contains(elo.vertices, { x: x, y: y })) colidiu = true; }); }
        if (colidiu) { let posX = obj.body ? obj.body.position.x : obj.visualX; let posY = obj.body ? obj.body.position.y : obj.visualY; let dist = Math.sqrt((posX - x)**2 + (posY - y)**2); if (dist < mDist) { mDist = dist; prox = obj; } }
    });
    if (prox) { selecionarObjetoDoEditor(prox); let posX = prox.body ? prox.body.position.x : prox.visualX; let posY = prox.body ? prox.body.position.y : prox.visualY; clickOffsetX = x - posX; clickOffsetY = y - posY; }
    else if (!pointer.leftButtonDown()) { desmarcarObjetoDoEditor(); }
}

function selecionarObjetoDoEditor(obj) {
    objetoSelecionado = obj; document.getElementById('btn-delete').style.display = 'block';
    let s = document.getElementById('status-modo'); s.innerText = "Editando selecionado"; s.style.color = "#ffea00";
    document.getElementById('prop-shape').value = obj.shape; atualizarInterfaceForma();
    if (obj.shape === 'rope') { document.getElementById('prop-rope-len').value = obj.ropeLen; document.getElementById('prop-rope-segments').value = obj.ropeSegments; document.getElementById('prop-rope-color').value = obj.ropeColor; }
    else {
        document.getElementById('prop-w').value = obj.w; document.getElementById('prop-h').value = obj.h; document.getElementById('prop-gravity').checked = obj.gravity; 
        document.getElementById('prop-lock-pos').checked = obj.lockPos; document.getElementById('prop-lock-rot').checked = obj.lockRot; document.getElementById('prop-manuseavel').checked = obj.manuseavel;
        document.getElementById('prop-lock-grab').checked = obj.naoAgarravel || false;
        document.getElementById('prop-is-static').checked = obj.body ? obj.body.isStatic : obj.isStatic; document.getElementById('prop-mass').value = obj.body ? obj.body.mass.toFixed(1) : obj.mass;
        document.getElementById('prop-air').value = obj.air; document.getElementById('prop-bounce').value = obj.bounce;
        document.getElementById('prop-max-vel').value = obj.maxVel || 0; document.getElementById('prop-max-rot').value = obj.maxRot || 0;
    }
}

function atualizarObjetoExistente() {
    if (ferramentaAtual !== 'select' || !objetoSelecionado) return;
    let obj = objetoSelecionado, scene = game.scene.getScene('default'), c = extrairCamposPainel();
    let px = obj.body ? obj.body.position.x : obj.visualX; let py = obj.body ? obj.body.position.y : obj.visualY;
    let anguloSalvo = obj.body ? obj.body.angle : 0;
    if (obj.shape === 'rope') {
        if (obj.ropeConstraints) obj.ropeConstraints.forEach(co => scene.matter.world.remove(co));
        if (obj.ropeElos) obj.ropeElos.forEach(el => scene.matter.world.remove(el));
        let elos = [], constraints = []; let segmentLen = c.ropeLen / c.ropeSegments; let lastBody = null;
        for (let i = 0; i < c.ropeSegments; i++) {
            let elo = scene.matter.add.rectangle(px, py + (i * segmentLen) + segmentLen/2, 12, segmentLen, { 
                isStatic: false, isSensor: false, mass: 0.8, frictionAir: 0.08, label: 'corpo_elo', collisionFilter: { category: 0x0002, mask: 0 } 
            });
            elo.manuseavel = false; elo.naoAgarravel = false; elos.push(elo);
            if (i === 0) constraints.push(scene.matter.add.worldConstraint(elo, 0, 0.15, { pointA: { x: px, y: py }, pointB: { x: 0, y: -segmentLen/2 }, damping: 0.2 }));
            else constraints.push(scene.matter.add.constraint(lastBody, elo, 0, 0.15, { pointA: { x: 0, y: segmentLen/2 }, pointB: { x: 0, y: -segmentLen/2 }, damping: 0.2 }));
            lastBody = elo;
        }
        obj.ropeElos = elos; obj.ropeConstraints = constraints; obj.ropeColor = c.ropeColor; obj.ropeSegments = c.ropeSegments; obj.ropeLen = c.ropeLen; return;
    }
    if (obj.body) scene.matter.world.remove(obj.body); obj.body = null;
    obj.shape = c.shape; obj.w = c.w; obj.h = c.h; obj.gravity = c.gravity; obj.lockPos = c.lockPos; obj.lockRot = c.lockRot; obj.mass = c.mass; obj.air = c.air; obj.bounce = c.bounce; obj.maxVel = c.maxVel; obj.maxRot = c.maxRot; obj.visualX = px; obj.visualY = py; obj.manuseavel = c.manuseavel; obj.naoAgarravel = c.lockGrab; obj.isStatic = c.isStatic;
    let conf = { isStatic: c.isStatic, label: 'ambiente', ignoreGravity: !obj.gravity, mass: obj.mass, friction: 0.8, frictionAir: c.air, restitution: c.bounce, collisionFilter: { category: CAT_AMBIENTE, mask: CAT_PLAYER | CAT_AMBIENTE } };
    if (obj.shape === 'box') obj.body = scene.matter.add.rectangle(px, py, obj.w, obj.h, conf);
    else if (obj.shape === 'circle') obj.body = scene.matter.add.circle(px, py, obj.w, conf);
    if (obj.body) { obj.body.manuseavel = c.manuseavel; obj.body.naoAgarravel = c.lockGrab; obj.body.label = 'ambiente'; if (!obj.body.isStatic) { scene.matter.body.setInertia(obj.body, obj.lockRot ? Infinity : obj.body.inertia); scene.matter.body.setAngle(obj.body, anguloSalvo); } }
}

function deletarObjetoSelecionado() {
    if (!objetoSelecionado) return; let scene = game.scene.getScene('default');
    if (objetoSelecionado.shape === 'rope') {
        if (objetoSelecionado.ropeConstraints) objetoSelecionado.ropeConstraints.forEach(co => scene.matter.world.remove(co));
        if (objetoSelecionado.ropeElos) objetoSelecionado.ropeElos.forEach(el => scene.matter.world.remove(el));
    } else if (objetoSelecionado.body) { scene.matter.world.remove(objetoSelecionado.body); }
    objetoSelecionado.gfx.clear(); objetoSelecionado.gfx.destroy(); listaObjetosEditaveis = listaObjetosEditaveis.filter(o => o !== objetoSelecionado); desmarcarObjetoDoEditor();
}

function calcularAlinhamentoPorProximidade(scene, x, y, w, h, shape, ignorarCorpo) {
    let finalX = x, finalY = y; const DISTANCIA_IMA = 20, corpos = scene.matter.world.localWorld.bodies;
    for (let i = 0; i < corpos.length; i++) {
        let b = corpos[i]; if (!b || b === ignorarCorpo || b.label !== 'ambiente') continue;
        const oE = b.bounds.min.x, oD = b.bounds.max.x, oT = b.bounds.min.y;
        if (x + w/2 >= oE - DISTANCIA_IMA && x - w/2 <= oD + DISTANCIA_IMA) { if (Math.abs((y + h/2) - oT) < DISTANCIA_IMA) { finalY = oT - h/2; break; } }
    }
    return { x: finalX, y: finalY };
}

function desenharObjetoEditor(obj) {
    if (!obj) return; let g = obj.gfx; g.clear();
    if (obj.shape === 'rope' && obj.ropeElos) {
        let corPuraHex = parseInt(obj.ropeColor.replace('#', '0x')); g.lineStyle(obj === objetoSelecionado ? 6 : 4, obj === objetoSelecionado ? 0xffea00 : corPuraHex, 1.0);
        g.beginPath(); g.moveTo(obj.posicaoTravadaX, obj.posicaoTravadaY); obj.ropeElos.forEach(elo => g.lineTo(elo.position.x, elo.position.y));
        g.strokePath(); g.fillStyle(0x111111, 0.7); obj.ropeElos.forEach(elo => g.fillCircle(elo.position.x, elo.position.y, 4)); return;
    }
    let posX = obj.body ? obj.body.position.x : obj.visualX; let posY = obj.body ? obj.body.position.y : obj.visualY;
    g.x = posX; g.y = posY; g.rotation = obj.body ? obj.body.angle : 0;
    g.fillStyle(obj.manuseavel ? 0x8b5a2b : (obj === objetoSelecionado ? 0xffea00 : 0x2c3e50), 1.0); g.lineStyle(2, obj.naoAgarravel ? 0xff0000 : 0xffffff, 0.8);
    if (obj.shape === 'box') { g.fillRect(-obj.w/2, -obj.h/2, obj.w, obj.h); g.strokeRect(-obj.w/2, -obj.h/2, obj.w, obj.h); }
    else if (obj.shape === 'circle') { g.fillCircle(0, 0, obj.w); g.strokeCircle(0, 0, obj.w); }
    else if (obj.shape === 'polygon' && obj.dadosDesenhoVisual) {
        g.beginPath(); g.moveTo(obj.dadosDesenhoVisual[0].x, obj.dadosDesenhoVisual[0].y);
        for (let i = 1; i < obj.dadosDesenhoVisual.length; i++) g.lineTo(obj.dadosDesenhoVisual[i].x, obj.dadosDesenhoVisual[i].y);
        g.closePath(); g.fillPath(); g.strokePath();
    }
}

function update() {
    let sAct = game.scene.getScene('default'); if (!sAct) return;
    if (modoEditorAtivo) {
        let camSpeed = 12; 
        if (cursorsKeyboard.left.isDown) this.cameras.main.scrollX -= camSpeed; 
        if (cursorsKeyboard.right.isDown) this.cameras.main.scrollX += camSpeed;
        if (cursorsKeyboard.up.isDown) this.cameras.main.scrollY -= camSpeed; 
        if (cursorsKeyboard.down.isDown) this.cameras.main.scrollY += camSpeed;
        
        listaObjetosEditaveis.forEach(obj => { if (obj) desenharObjetoEditor(obj); }); 
        return;
    }

    if (player1) handlePlayerInput(this, player1); 
    if (player2) handlePlayerInput(this, player2); 
    [player1, player2].forEach(p => { if (!p) return; aplicarLimiteFrame(sAct, p.body, 10); });
    
    [player1, player2].forEach(p => {
        if (!p) return;
        if (p.leftJoint && p.leftJointPontoPivorMundo) {
            sAct.matter.body.setPosition(p.leftHand, { x: p.leftJointPontoPivorMundo.x, y: p.leftJointPontoPivorMundo.y });
            sAct.matter.body.setVelocity(p.leftHand, { x: 0, y: 0 });
        }
        if (p.rightJoint && p.rightJointPontoPivorMundo) {
            sAct.matter.body.setPosition(p.rightHand, { x: p.rightJointPontoPivorMundo.x, y: p.rightJointPontoPivorMundo.y });
            sAct.matter.body.setVelocity(p.rightHand, { x: 0, y: 0 });
        }
    });

    if (player1) { player1.gfx.clear(); desenharJogador(player1); } 
    if (player2) { player2.gfx.clear(); desenharJogador(player2); }
    
    listaObjetosEditaveis.forEach(obj => {
        if (obj && obj.body && obj.lockPos) {
            if (obj.body.position.x !== obj.posicaoTravadaX || obj.body.position.y !== obj.posicaoTravadaY) {
                game.scene.getScene('default').matter.body.setPosition(obj.body, { x: obj.posicaoTravadaX, y: obj.posicaoTravadaY });
                game.scene.getScene('default').matter.body.setVelocity(obj.body, { x: 0, y: 0 });
            }
        }
        if (obj) desenharObjetoEditor(obj);
    });

    // LÓGICA DE SEGUIMENTO E ZOOM DA CÂMERA (CORRIGIDA)
    let targetX = 0, targetY = 0, targetZoom = 1;

    if (player1 && player2) {
        targetX = (player1.body.position.x + player2.body.position.x) / 2;
        targetY = (player1.body.position.y + player2.body.position.y) / 2;
        let dist = Phaser.Math.Distance.Between(player1.body.position.x, player1.body.position.y, player2.body.position.x, player2.body.position.y);
        targetZoom = Phaser.Math.Clamp(SCREEN_WIDTH / (dist + 300), 0.45, 1.0);
    } else if (player1) {
        targetX = player1.body.position.x;
        targetY = player1.body.position.y;
    } else if (player2) {
        targetX = player2.body.position.x;
        targetY = player2.body.position.y;
    }

    if (player1 || player2) {
        this.cameras.main.scrollX = Phaser.Math.Linear(this.cameras.main.scrollX, targetX - SCREEN_WIDTH / 2, 0.08);
        this.cameras.main.scrollY = Phaser.Math.Linear(this.cameras.main.scrollY, targetY - SCREEN_HEIGHT / 2, 0.08);
        this.cameras.main.setZoom(Phaser.Math.Linear(this.cameras.main.zoom, targetZoom, 0.05));
    }
}
