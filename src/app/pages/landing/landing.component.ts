import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {
  readonly features = [
    {
      icon: 'casino',
      title: 'Dados 3D',
      desc: 'Lanza d4, d6, d8, d10, d12, d20 y d100 con animaciones espectaculares. Soporte para 1 a 10 dados, ventaja y desventaja.',
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
    },
    {
      icon: 'map',
      title: 'Mapas interactivos',
      desc: 'Usa imágenes o vídeos de YouTube como fondo. Mueve y rota tokens con zoom y paneo fluido.',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      icon: 'videocam',
      title: 'Videollamada integrada',
      desc: 'Habla cara a cara con toda la mesa sin salir de la plataforma. WebRTC sin instalaciones.',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
    },
    {
      icon: 'format_list_numbered',
      title: 'Iniciativa de combate',
      desc: 'Tirada de iniciativa automática para todos. Avanza turnos, reordena y muestra u oculta el orden a los jugadores.',
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      icon: 'person',
      title: 'Personajes completos',
      desc: 'Crea PJs y NPCs con HP, máx HP, AC, condiciones D&D y avatar. Los jugadores reclaman su personaje.',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      icon: 'shield',
      title: 'Panel del Dungeon Master',
      desc: 'Control total: spawnea tokens, ajusta stats en tiempo real, gestiona el mapa y mantén la iniciativa.',
      color: 'text-rose-400',
      bg: 'bg-rose-500/10 border-rose-500/20',
    },
  ];

  readonly steps = [
    {
      num: '01',
      title: 'Crea o únete',
      desc: 'El DM crea la sala con su llave secreta. Los jugadores entran con el código de sala.',
      icon: 'meeting_room',
    },
    {
      num: '02',
      title: 'Prepara el escenario',
      desc: 'Sube tu mapa, añade tokens de PJs y NPCs, configura HP y define el orden de iniciativa.',
      icon: 'auto_stories',
    },
    {
      num: '03',
      title: 'Vive la aventura',
      desc: 'Lanza dados, mueve tokens, gestiona combates y narra la historia en tiempo real.',
      icon: 'sword_rose',
    },
  ];
}
