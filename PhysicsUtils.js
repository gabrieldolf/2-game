const CAT_AMBIENTE = 0x0001, CAT_PLAYER = 0x0002;

function createArmSegment(scene, bA, bB, num, len, id, grp, list, listaJuntas) {
    let last = bA;
    for (let i = 0; i < num; i++) {
        const lastLink = (i === num - 1);
        let link = lastLink ? bB : scene.matter.add.rectangle(bA.position.x, bA.position.y, 12, len, { density: 0.005, frictionAir: 0.01, label: `p${id}_braco`, collisionFilter: { category: CAT_PLAYER, mask: CAT_AMBIENTE | CAT_PLAYER, group: grp } });
        if (!lastLink) list.push(link);
        let c = scene.matter.add.constraint(last, link, 0, 0.9, { pointA: last === bA ? { x:0, y:0 } : { x:0, y: len/2 }, pointB: lastLink ? { x:0, y:0 } : { x:0, y: -len/2 }, stiffness: 0.9 });
        if (listaJuntas) listaJuntas.push(c);
        last = link;
    }
}

function createHeaveHoCharacter(scene, x, y, pad, id, col) {
    const grp = scene.matter.world.nextGroup(true), flt = { category: CAT_PLAYER, mask: CAT_AMBIENTE | CAT_PLAYER, group: grp };
    const b = scene.matter.add.circle(x, y, 22, { friction: 0.3, density: 0.05, label: `p${id}_body`, collisionFilter: flt });
    const lH = scene.matter.add.circle(x - 100, y, 14, { density: 0.0005, friction: 0.8, frictionAir: 0.01, label: `p${id}_leftHand`, collisionFilter: flt });
    const rH = scene.matter.add.circle(x + 100, y, 14, { density: 0.0005, friction: 0.8, frictionAir: 0.01, label: `p${id}_rightHand`, collisionFilter: flt });
    
    lH.corpoTocadoAgora = null; rH.corpoTocadoAgora = null; 
    let lL = [], rL = [], juntasBraço = [];
    
    createArmSegment(scene, b, lH, 3, 32, id, grp, lL, juntasBraço);
    createArmSegment(scene, b, rH, 3, 32, id, grp, rL, juntasBraço);
    
    return { id: id, body: b, leftHand: lH, rightHand: rH, leftElos: lL, rightElos: rL, juntasEstruturaisDosBramos: juntasBraço, gfx: scene.add.graphics().setDepth(10), bodyColor: col, pad: pad, leftJoint: null, rightJoint: null };
}

function processarToqueParaContato(h, b, pair) {
    if (h.label && (h.label.includes('_leftHand') || h.label.includes('_rightHand'))) {
        if (b.label === 'ambiente' || b.label === 'corpo_elo' || b.label.startsWith('p0_') || b.label.startsWith('p1_')) {
            if (b.label !== h.label.substring(0, 3) + 'body' && !b.label.includes('braco')) {
                h.corpoTocadoAgora = b;
                if (pair.activeContacts && pair.activeContacts.length > 0) h.pontoDeContatoGlobal = { x: pair.activeContacts[0].vertex.x, y: pair.activeContacts[0].vertex.y };
                else h.pontoDeContatoGlobal = { x: h.position.x, y: h.position.y };
            }
        }
    }
}

function quebrarToqueParaContato(h, b) { if (h.label && (h.label.includes('_leftHand') || h.label.includes('_rightHand'))) { if (h.corpoTocadoAgora === b) { h.corpoTocadoAgora = null; h.pontoDeContatoGlobal = null; } } }
function isButtonPressed(pad, buttonIndex) {
    // Retorna false se o controle (pad) não existir
    if (!pad || !pad.buttons) return false;
    
    return pad.buttons[buttonIndex]?.pressed || false;
}

function aplicarLimiteFrame(scene, body, maxDist) {
    if (!body || !body.position || body.isStatic || isNaN(body.position.x)) return;
    if (body.ultimaPos) { 
        let dx = body.position.x - body.ultimaPos.x, dy = body.position.y - body.ultimaPos.y; 
        if (dx*dx + dy*dy > maxDist*maxDist) { 
            let d = Math.sqrt(dx*dx + dy*dy); 
            if (d > 0) scene.matter.body.setPosition(body, { x: body.ultimaPos.x + (dx/d)*maxDist, y: body.ultimaPos.y + (dy/d)*maxDist }); 
        } 
    }
    body.ultimaPos = { x: body.position.x, y: body.position.y };

    [player1, player2].forEach(p => {
        if (!p || p.body !== body) return;
        const RAIO_CORPO = 22; const DIST_ELOS = 32;

        if (p.leftElos && p.leftElos.length > 0 && !p.leftJoint) {
            let elo0 = p.leftElos[0]; if (elo0 && !isNaN(elo0.position.x)) {
                let dX = elo0.position.x - body.position.x, dY = elo0.position.y - body.position.y, dist = Math.sqrt(dX*dX + dY*dY);
                if (dist > RAIO_CORPO && dist > 0) scene.matter.body.setPosition(elo0, { x: body.position.x + (dX/dist)*RAIO_CORPO, y: body.position.y + (dY/dist)*RAIO_CORPO });
                let paiX = elo0.position.x, paiY = elo0.position.y;
                for (let i = 1; i < p.leftElos.length; i++) {
                    let elo = p.leftElos[i]; if (!elo || isNaN(elo.position.x)) continue;
                    let dx = elo.position.x - paiX, dy = elo.position.y - paiY, d = Math.sqrt(dx*dx + dy*dy);
                    if (d > DIST_ELOS && d > 0) scene.matter.body.setPosition(elo, { x: paiX + (dx/d)*DIST_ELOS, y: paiY + (dy/d)*DIST_ELOS });
                    paiX = elo.position.x; paiY = elo.position.y;
                }
                let hand = p.leftHand; if (hand && !isNaN(hand.position.x)) {
                    let dxH = hand.position.x - paiX, dyH = hand.position.y - paiY, dH = Math.sqrt(dxH*dxH + dyH*dyH);
                    if (dH > DIST_ELOS && dH > 0) scene.matter.body.setPosition(hand, { x: paiX + (dxH/dH)*DIST_ELOS, y: paiY + (dyH/dH)*DIST_ELOS });
                }
            }
        }

        if (p.rightElos && p.rightElos.length > 0 && !p.rightJoint) {
            let elo0 = p.rightElos[0]; if (elo0 && !isNaN(elo0.position.x)) {
                let dX = elo0.position.x - body.position.x, dY = elo0.position.y - body.position.y, dist = Math.sqrt(dX*dX + dY*dY);
                if (dist > RAIO_CORPO && dist > 0) scene.matter.body.setPosition(elo0, { x: body.position.x + (dX/dist)*RAIO_CORPO, y: body.position.y + (dY/dist)*RAIO_CORPO });
                let paiX = elo0.position.x, paiY = elo0.position.y;
                for (let i = 1; i < p.rightElos.length; i++) {
                    let elo = p.rightElos[i]; if (!elo || isNaN(elo.position.x)) continue;
                    let dx = elo.position.x - paiX, dy = elo.position.y - paiY, d = Math.sqrt(dx*dx + dy*dy);
                    if (d > DIST_ELOS && d > 0) scene.matter.body.setPosition(elo, { x: paiX + (dx/d)*DIST_ELOS, y: paiY + (dy/d)*DIST_ELOS });
                    paiX = elo.position.x; paiY = elo.position.y;
                }
                let hand = p.rightHand; if (hand && !isNaN(hand.position.x)) {
                    let dxH = hand.position.x - paiX, dyH = hand.position.y - paiY, dH = Math.sqrt(dxH*dxH + dyH*dyH);
                    if (dH > DIST_ELOS && dH > 0) scene.matter.body.setPosition(hand, { x: paiX + (dxH/dH)*DIST_ELOS, y: paiY + (dyH/dH)*DIST_ELOS });
                }
            }
        }
    });
}

function desenharJogador(p) {
    const g = p.gfx; g.clear(); g.lineStyle(12, 0x000000, 1);
    g.beginPath(); g.moveTo(p.body.position.x, p.body.position.y); p.leftElos.forEach(e => g.lineTo(e.position.x, e.position.y)); g.lineTo(p.leftHand.position.x, p.leftHand.position.y); g.lineStyle(12, 0xff0000, 1); g.strokePath();
    g.beginPath(); g.moveTo(p.body.position.x, p.body.position.y); p.rightElos.forEach(e => g.lineTo(e.position.x, e.position.y)); g.lineTo(p.rightHand.position.x, p.rightHand.position.y); g.lineStyle(12, 0x0000ff, 1); g.strokePath();
    g.fillStyle(p.bodyColor, 1).fillCircle(p.body.position.x, p.body.position.y, 22); const pad = p.pad; const lL = isButtonPressed(pad, 6) || isButtonPressed(pad, 4), rR = isButtonPressed(pad, 7) || isButtonPressed(pad, 5);
    g.fillStyle(lL ? 0xff8888 : 0xff0000, 1).fillCircle(p.leftHand.position.x, p.leftHand.position.y, 14); g.fillStyle(rR ? 0x8888ff : 0x0000ff, 1).fillCircle(p.rightHand.position.x, p.rightHand.position.y, 14);
}

function processarGarra(s, p, h, jKey, grab) {
    if (grab && !p[jKey]) {
        let caixaDeteccao = { min: { x: h.position.x - 16, y: h.position.y - 16 }, max: { x: h.position.x + 16, y: h.position.y + 16 } };
        let alvoCorpo = null;

        for (let i = 0; i < bordasFixasDoCenario.length; i++) {
            let b = bordasFixasDoCenario[i]; if (!b || b.naoAgarravel) continue;
            if (s.matter.query.region([b], caixaDeteccao).length > 0) { alvoCorpo = b; break; }
        }
        if (!alvoCorpo) {
            for (let i = 0; i < listaObjetosEditaveis.length; i++) {
                let obj = listaObjetosEditaveis[i]; if (!obj || obj.naoAgarravel) continue;
                if (obj.body && !obj.body.naoAgarravel && s.matter.query.region([obj.body], caixaDeteccao).length > 0) { alvoCorpo = obj.body; break; }
                else if (obj.shape === 'rope' && obj.ropeElos) {
                    for (let j = 0; j < obj.ropeElos.length; j++) {
                        if (!obj.ropeElos[j].naoAgarravel && s.matter.query.region([obj.ropeElos[j]], caixaDeteccao).length > 0) { alvoCorpo = obj.ropeElos[j]; break; }
                    }
                    if (alvoCorpo) break;
                }
            }
        }
        if (alvoCorpo) {
            let alvoValido = alvoCorpo.parent ? alvoCorpo.parent : alvoCorpo;
            let flashGfx = s.add.graphics().setDepth(20);
            flashGfx.lineStyle(4, 0xffea00, 1); flashGfx.lineBetween(h.position.x, h.position.y, h.position.x, h.position.y + 4);
            s.time.delayedCall(150, () => { flashGfx.clear(); flashGfx.destroy(); });
            s.matter.body.setVelocity(h, { x: 0, y: 0 }); s.matter.body.setAngularVelocity(h, 0);
            
            let dx = h.position.x - alvoValido.position.x, dy = h.position.y - alvoValido.position.y;
            let r = alvoValido.rotation ? alvoValido.rotation : 0; if (isNaN(r)) r = 0;
            let localOffset = { x: dx * Math.cos(-r) - dy * Math.sin(-r), y: dx * Math.sin(-r) + dy * Math.cos(-r) };

            let rigidezAgarrar = (alvoValido.label === 'corpo_elo') ? 0.2 : 1.0;
            let amortecimentoAgarrar = (alvoValido.label === 'corpo_elo') ? 0.1 : 0;

            if (alvoValido.isStatic) {
                p[jKey + 'PontoPivorMundo'] = { x: h.position.x, y: h.position.y };
                p[jKey] = s.matter.add.worldConstraint(h, 0, rigidezAgarrar, { pointA: { x: h.position.x, y: h.position.y }, pointB: { x: 0, y: 0 }, stiffness: rigidezAgarrar, damping: amortecimentoAgarrar });
            } else {
                p[jKey + 'PontoPivorMundo'] = null;
                p[jKey] = s.matter.add.constraint(h, alvoValido, 0, rigidezAgarrar, { pointA: { x: 0, y: 0 }, pointB: localOffset, stiffness: rigidezAgarrar, damping: amortecimentoAgarrar });
            }
            p[jKey + 'Target'] = alvoValido; p[jKey + 'PivotBody'] = null; p[jKey + 'LocalOffset'] = localOffset;
            s.matter.body.setVelocity(p.body, { x: p.body.velocity.x * 0.1, y: p.body.velocity.y * 0.1 });
        }
    } else if (!grab && p[jKey]) {
        if (p[jKey]) s.matter.world.remove(p[jKey]);
        p[jKey] = null; p[jKey + 'Target'] = null; p[jKey + 'PivotBody'] = null; p[jKey + 'LocalOffset'] = null; p[jKey + 'PontoPivorMundo'] = null;
    }
}

function handlePlayerInput(s, p) {
    const pad = p.pad; if (!pad) return; 
    const lL = isButtonPressed(pad, 6) || isButtonPressed(pad, 4); const rR = isButtonPressed(pad, 7) || isButtonPressed(pad, 5);
    if (isButtonPressed(pad, 8)) { executarRespawnIndividual(s, p.id); return; }
    let campoMod = document.getElementById('prop-fall-weight-mod'); let valorModificador = campoMod ? parseFloat(campoMod.value) : 10.0;
    let massaCalculadaCorpo = 6.8; let totalmenteLivreNoVazio = (!p.leftJoint && !p.rightJoint);
    if (p.body.velocity.y > 0.5 && (pad.leftStick?.y < -0.15 || pad.rightStick?.y < -0.15) && totalmenteLivreNoVazio) {
        let deltaYEsq = Math.max(0, p.body.position.y - p.leftHand.position.y); let deltaYDir = Math.max(0, p.body.position.y - p.rightHand.position.y);
        massaCalculadaCorpo += (deltaYEsq + deltaYDir) * valorModificador * 0.1;
    }
    if (p.body.mass !== massaCalculadaCorpo) s.matter.body.setMass(p.body, massaCalculadaCorpo);

    const FORCA_ESCALADA_CENARIO = 0.045, FORCA_MOVER_CAIXA = 0.025, RAIO_ORBITA_BRACO = 96;
    let movendoEsquerdo = pad.leftStick && (pad.leftStick.x*pad.leftStick.x + pad.leftStick.y*pad.leftStick.y > 0.02);
    let movendoDireito = pad.rightStick && (pad.rightStick.x*pad.rightStick.x + pad.rightStick.y*pad.rightStick.y > 0.02);
    
    const aplicarImpulsoPendular = (pivoMao, analogico) => {
        let dx = p.body.position.x - pivoMao.position.x;
        let dy = p.body.position.y - pivoMao.position.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
            let nx = dx / dist;
            let ny = dy / dist;

            let tx = -ny;
            let ty = nx;

            let projComposta = analogico.x * tx + analogico.y * ty;
            let magStick = Math.sqrt(analogico.x * analogico.x + analogico.y * analogico.y);

            let fatorEmbalo = 0.018 * magStick;
            let forcaX = (tx * projComposta * 0.8 + analogico.x * 0.2) * fatorEmbalo;
            let forcaY = (ty * projComposta * 0.8 + analogico.y * 0.2) * fatorEmbalo;

            s.matter.body.applyForce(p.body, p.body.position, { x: forcaX, y: forcaY });
        }
    };

    if (p.leftJoint && p.leftJointTarget && !p.leftJointTarget.manuseavel) {
        if (pad.leftStick) {
            aplicarImpulsoPendular(p.leftHand, pad.leftStick);
        }
        let elo = p.leftJointTarget;
        if (pad.leftStick && elo.body) {
            let dX = p.body.position.x - elo.position.x, dY = p.body.position.y - elo.position.y, dist = Math.sqrt(dX*dX + dY*dY);
            if (dist > 20) { let intensity = Math.sqrt(pad.leftStick.x**2 + pad.leftStick.y**2); let fatorEmbaloX = elo.velocity.x * 0.0015; let forcaX = (dX / dist) * 0.0048 * intensity + fatorEmbaloX; let forcaY = (dY / dist) * 0.0035 * intensity; s.matter.body.applyForce(elo, elo.position, { x: forcaX, y: forcaY }); }
        }
    } else if (p.leftJoint && p.leftJointTarget && p.leftJointTarget.manuseavel) {
        if (pad.leftStick) {
            let fx = pad.leftStick.x * FORCA_MOVER_CAIXA;
            let fy = pad.leftStick.y * FORCA_MOVER_CAIXA;

            s.matter.body.applyForce(p.leftHand, p.leftHand.position, { x: fx, y: fy });
            s.matter.body.applyForce(p.body, p.body.position, { x: -fx, y: -fy });
        }
    } else {
        if (movendoEsquerdo && !p.leftJoint) { let a = Math.atan2(pad.leftStick.y, pad.leftStick.x); let posXAlvo = p.body.position.x + Math.cos(a)*RAIO_ORBITA_BRACO; let posYAlvo = p.body.position.y + Math.sin(a)*RAIO_ORBITA_BRACO; s.matter.body.setVelocity(p.leftHand, { x: (posXAlvo - p.leftHand.position.x)*0.22, y: (posYAlvo - p.leftHand.position.y)*0.22 }); }
    }

    if (p.rightJoint && p.rightJointTarget && !p.rightJointTarget.manuseavel) {
        if (pad.rightStick) {
            aplicarImpulsoPendular(p.rightHand, pad.rightStick);
        }
        let elo = p.rightJointTarget;
        if (pad.rightStick && elo.body) {
            let dX = p.body.position.x - elo.position.x, dY = p.body.position.y - elo.position.y, dist = Math.sqrt(dX*dX + dY*dY);
            if (dist > 20) { let intensity = Math.sqrt(pad.rightStick.x**2 + pad.rightStick.y**2); let fatorEmbaloX = elo.velocity.x * 0.0015; let forcaX = (dX / dist) * 0.0048 * intensity + fatorEmbaloX; let forcaY = (dY / dist) * 0.0035 * intensity; s.matter.body.applyForce(elo, elo.position, { x: forcaX, y: forcaY }); }
        }
    } else if (p.rightJoint && p.rightJointTarget && p.rightJointTarget.manuseavel) {
        if (pad.rightStick) {
            let fx = pad.rightStick.x * FORCA_MOVER_CAIXA;
            let fy = pad.rightStick.y * FORCA_MOVER_CAIXA;

            s.matter.body.applyForce(p.rightHand, p.rightHand.position, { x: fx, y: fy });
            s.matter.body.applyForce(p.body, p.body.position, { x: -fx, y: -fy });
        }
    } else {
        if (movendoDireito && !p.rightJoint) { let a = Math.atan2(pad.rightStick.y, pad.rightStick.x); let posXAlvo = p.body.position.x + Math.cos(a)*RAIO_ORBITA_BRACO; let posYAlvo = p.body.position.y + Math.sin(a)*RAIO_ORBITA_BRACO; s.matter.body.setVelocity(p.rightHand, { x: (posXAlvo - p.rightHand.position.x)*0.22, y: (posYAlvo - p.rightHand.position.y)*0.22 }); }
    }
    processarGarra(s, p, p.leftHand, 'leftJoint', lL); processarGarra(s, p, p.rightHand, 'rightJoint', rR);
}

function executarRespawnIndividual(scene, pNum) {
    let p = (pNum === 0) ? player1 : player2; if (!p) return;
    
    if (p.leftJoint) { scene.matter.world.remove(p.leftJoint); }
    if (p.rightJoint) { scene.matter.world.remove(p.rightJoint); }
    
    if (p.juntasEstruturaisDosBramos) {
        p.juntasEstruturaisDosBramos.forEach(junta => { scene.matter.world.remove(junta); });
    }
    
    scene.matter.world.remove(p.body); 
    scene.matter.world.remove(p.leftHand); 
    scene.matter.world.remove(p.rightHand);
    if (p.leftElos) p.leftElos.forEach(e => scene.matter.world.remove(e));
    if (p.rightElos) p.rightElos.forEach(e => scene.matter.world.remove(e));
    if (p.gfx) { p.gfx.clear(); p.gfx.destroy(); }
    
    if (pNum === 0) player1 = createHeaveHoCharacter(scene, 300, WORLD_HEIGHT - 150, p.pad, 0, 0x00ff00);
    else player2 = createHeaveHoCharacter(scene, 500, WORLD_HEIGHT - 150, p.pad, 1, 0xffff00);
}
