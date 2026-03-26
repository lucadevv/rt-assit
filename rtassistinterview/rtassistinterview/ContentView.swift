//
//  ContentView.swift
//  rtassistinterview
//
//  Vista principal de la aplicación
//

import SwiftUI

struct ContentView: View {
    @StateObject private var transcriptionManager = TranscriptionManager()
    @State private var showFloatingPanel = false
    
    var body: some View {
        VStack(spacing: 24) {
            // Icono animado según estado
            ZStack {
                Circle()
                    .fill(Color.blue.opacity(0.2))
                    .frame(width: 80, height: 80)
                
                Image(systemName: transcriptionManager.isListening ? "waveform" : "mic")
                    .font(.system(size: 40))
                    .foregroundColor(.blue)
                    .scaleEffect(transcriptionManager.isListening ? 1.1 : 1.0)
                    .animation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true), value: transcriptionManager.isListening)
            }
            
            Text("rtassist")
                .font(.title)
                .fontWeight(.semibold)
            
            Text("Asistente de entrevistas")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            Divider()
                .frame(width: 200)
            
            // Indicador de conexión
            HStack {
                Circle()
                    .fill(transcriptionManager.isConnected ? Color.green : Color.red)
                    .frame(width: 8, height: 8)
                Text(transcriptionManager.isConnected ? "Conectado al backend" : "Desconectado")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            // Botón toggle del overlay
            Button(action: {
                withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
                    showFloatingPanel.toggle()
                }
            }) {
                HStack {
                    Image(systemName: showFloatingPanel ? "rectangle.inset.filled" : "rectangle")
                    Text(showFloatingPanel ? "Ocultar Overlay" : "Mostrar Overlay")
                }
                .font(.title3)
                .padding(.horizontal, 24)
                .padding(.vertical, 12)
                .background(
                    Capsule()
                        .fill(Color.blue.opacity(0.15))
                )
            }
            .buttonStyle(.plain)
            
            // Vista previa del texto actual
            VStack(alignment: .leading, spacing: 8) {
                Text("Vista previa:")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                // Mostrar últimas líneas o la actual
                let previewText = transcriptionManager.transcriptLines.last ?? transcriptionManager.currentLine
                
                Text(previewText.isEmpty ? "Esperando transcripción..." : previewText)
                    .font(.body)
                    .foregroundColor(.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color(.textBackgroundColor))
                    )
            }
            .padding(.horizontal)
            
            // Info del servidor
            Text("Backend: ws://localhost:8765/ws")
                .font(.caption2)
                .foregroundColor(.secondary.opacity(0.7))
            
            // Debug info - mostrar error si hay
            if let error = transcriptionManager.errorMessage {
                Text("Error: \(error)")
                    .font(.caption)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }
        }
        .frame(width: 450, height: 450)
        .padding()
        .onAppear {
            transcriptionManager.connect()
        }
        .onDisappear {
            transcriptionManager.disconnect()
        }
        .floatingPanel(
            isPresented: $showFloatingPanel,
            contentRect: CGRect(x: 0, y: 0, width: 580, height: 160)
        ) {
            FloatingPanelView(transcriptionManager: transcriptionManager)
        }
    }
}

#if DEBUG
struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
#endif
