//
//  FloatingPanelView.swift
//  rtassistinterview
//
//  Vista del overlay flotante
//

import SwiftUI

struct FloatingPanelView: View {
    @ObservedObject var transcriptionManager: TranscriptionManager
    @State private var isHovering = false
    
    var body: some View {
        VStack(spacing: 8) {
            // Cabecera minimalista
            HStack {
                // Indicador de estado
                HStack(spacing: 6) {
                    Circle()
                        .fill(statusColor)
                        .frame(width: 8, height: 8)
                        .overlay(
                            Circle()
                                .stroke(statusColor.opacity(0.5), lineWidth: 2)
                                .scaleEffect(statusScale)
                                .opacity(statusOpacity)
                        )
                    
                    Text(statusText)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                // Contador de líneas
                if !transcriptionManager.transcriptLines.isEmpty {
                    Text("\(transcriptionManager.transcriptLines.count) líneas")
                        .font(.caption2)
                        .foregroundColor(.secondary.opacity(0.6))
                }
            }
            
            // Líneas de transcripción (últimas 10)
            ScrollViewReader { proxy in
                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(alignment: .leading, spacing: 6) {
                        ForEach(Array(transcriptionManager.transcriptLines.enumerated()), id: \.offset) { index, line in
                            Text(line)
                                .font(.system(.callout, design: .rounded))
                                .fontWeight(index == transcriptionManager.transcriptLines.count - 1 ? .semibold : .regular)
                                .foregroundColor(.primary)
                                .opacity(index == transcriptionManager.transcriptLines.count - 1 ? 1.0 : 0.75)
                                .lineLimit(nil)
                                .multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .id(index)
                                .transition(.asymmetric(
                                    insertion: .move(edge: .bottom).combined(with: .opacity),
                                    removal: .opacity
                                ))
                        }
                        
                        // Línea actual siendo escrita
                        if transcriptionManager.isStreaming && !transcriptionManager.currentLine.isEmpty {
                            HStack(alignment: .bottom, spacing: 0) {
                                Text(transcriptionManager.currentLine)
                                    .font(.system(.callout, design: .rounded))
                                    .fontWeight(.semibold)
                                    .foregroundColor(.blue)
                                    .lineLimit(nil)
                                
                                // Cursor parpadeante
                                Text("▊")
                                    .font(.system(.callout, design: .rounded))
                                    .foregroundColor(.blue)
                                    .opacity(0.8)
                            }
                            .id("streaming")
                            .transition(.opacity)
                        }
                    }
                    .padding(.horizontal, 4)
                }
                .frame(maxHeight: 100)
                .onChange(of: transcriptionManager.transcriptLines.count) { _ in
                    // Auto-scroll a la última línea
                    if let lastIndex = transcriptionManager.transcriptLines.indices.last {
                        withAnimation(.easeOut(duration: 0.3)) {
                            proxy.scrollTo(lastIndex, anchor: .bottom)
                        }
                    }
                }
                .onChange(of: transcriptionManager.isStreaming) { streaming in
                    if streaming {
                        withAnimation(.easeOut(duration: 0.3)) {
                            proxy.scrollTo("streaming", anchor: .bottom)
                        }
                    }
                }
            }
            
            // Barra de progreso cuando está pensando
            if transcriptionManager.isThinking {
                HStack(spacing: 4) {
                    ProgressView()
                        .scaleEffect(0.7)
                    Text("Analizando...")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                .transition(.opacity)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.ultraThinMaterial)
                .shadow(color: .black.opacity(0.2), radius: 15, x: 0, y: 5)
        )
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovering = hovering
            }
        }
    }
    
    // MARK: - Estado
    
    private var statusColor: Color {
        if transcriptionManager.isThinking {
            return .orange
        } else if transcriptionManager.isStreaming {
            return .blue
        } else if transcriptionManager.isListening {
            return .green
        } else if transcriptionManager.isConnected {
            return .green.opacity(0.6)
        } else {
            return .red
        }
    }
    
    private var statusText: String {
        if transcriptionManager.isThinking {
            return "Analizando"
        } else if transcriptionManager.isStreaming {
            return "Escribiendo"
        } else if transcriptionManager.isListening {
            return "Escuchando"
        } else if transcriptionManager.isConnected {
            return "Listo"
        } else {
            return "Desconectado"
        }
    }
    
    private var statusScale: CGFloat {
        transcriptionManager.isListening || transcriptionManager.isStreaming ? 1.5 : 1.0
    }
    
    private var statusOpacity: Double {
        transcriptionManager.isListening || transcriptionManager.isStreaming ? 0.6 : 0
    }
}

// MARK: - Preview

#if DEBUG
struct FloatingPanelView_Previews: PreviewProvider {
    static var previews: some View {
        FloatingPanelView(
            transcriptionManager: {
                let manager = TranscriptionManager()
                manager.transcriptLines = [
                    "Hola, me llamo Luis",
                    "Estoy desarrollando un asistente",
                    "Para entrevistas de trabajo",
                    "Que ayuda con preguntas técnicas",
                    "Y respuestas en tiempo real"
                ]
                manager.isConnected = true
                return manager
            }()
        )
        .frame(width: 500, height: 180)
        .padding()
        .background(.ultraThinMaterial)
    }
}
#endif
