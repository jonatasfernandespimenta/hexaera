// Eventos do jogo para o PostHog (iniciado em instrumentation-client.ts). Sem init (dev, testes) não faz nada.
import posthog from 'posthog-js'

export const track = (event: string, props?: Record<string, unknown>) => { if (posthog.__loaded) posthog.capture(event, props) }

// Contexto da partida (modo, turno, era) vai em todos os eventos da sessão, inclusive no $pageleave:
// é assim que se vê em que turno o jogador fechou a aba.
export const context = (props: Record<string, unknown>) => { if (posthog.__loaded) posthog.register_for_session(props) }
