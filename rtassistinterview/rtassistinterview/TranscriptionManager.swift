//
//  TranscriptionManager.swift
//  rtassistinterview
//
//  Gestor de WebSocket y estado de transcripción
//

import Foundation
import Combine
import SwiftUI

// MARK: - Mensajes del WebSocket
struct WebSocketMessage: Codable {
    let type: String
    let content: String
    let speaker: Int?
    let ms: Int64?
}

class TranscriptionManager: ObservableObject {
    // Propiedades principales
    @Published var transcriptLines: [String] = []  // Últimas 10 líneas
    @Published var currentLine: String = ""        // Línea actual siendo escrita
    @Published var isStreaming: Bool = false      // Si está escribiendo
    @Published var isListening: Bool = false       // Si está escuchando audio
    @Published var isConnected: Bool = false
    @Published var isThinking: Bool = false
    @Published var errorMessage: String?
    
    // Configuración
    private let maxLines: Int = 10
    private let typingSpeed: Double = 0.03  // Segundos por carácter
    
    // WebSocket
    private var webSocketTask: URLSessionWebSocketTask?
    private var typingTimer: Timer?
    private var typingBuffer: String = ""
    private var typingIndex: String.Index?
    
    // URL del backend
    private let wsURL: String
    
    init(wsURL: String = "ws://127.0.0.1:8765/ws") {
        self.wsURL = wsURL
    }
    
    // MARK: - Conexión WebSocket
    
    func connect() {
        guard let url = URL(string: wsURL) else {
            errorMessage = "URL inválida"
            return
        }
        
        var request = URLRequest(url: url)
        request.timeoutInterval = 10
        
        webSocketTask = URLSession.shared.webSocketTask(with: request)
        webSocketTask?.resume()
        isConnected = true
        
        print("[WebSocket] Conectando a \(wsURL)")
        receiveMessage()
    }
    
    func disconnect() {
        stopTyping()
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        isConnected = false
        isListening = false
    }
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let message):
                    self?.handleMessage(message)
                    self?.receiveMessage()
                    
                case .failure(let error):
                    print("[WebSocket] Error: \(error.localizedDescription)")
                    self?.isConnected = false
                    self?.isListening = false
                    
                    // Reconectar automáticamente
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                        if self?.webSocketTask == nil {
                            self?.connect()
                        }
                    }
                }
            }
        }
    }
    
    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            parseMessage(text)
        case .data(let data):
            if let text = String(data: data, encoding: .utf8) {
                parseMessage(text)
            }
        @unknown default:
            break
        }
    }
    
    private func parseMessage(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            // No es JSON, mostrar directamente
            appendTranscriptLine(text)
            return
        }
        
        let type = json["type"] as? String ?? ""
        let content = json["content"] as? String ?? ""
        
        switch type {
        case "transcript":
            // Transcripción de voz
            appendTranscriptLine(content)
            isListening = !content.isEmpty
            
        case "token":
            // Token individual del LLM - typing effect
            appendTypingText(content)
            
        case "thinking":
            // Indicador de "pensando"
            isThinking = true
            appendTypingText(content)
            
        case "error":
            errorMessage = content
            
        default:
            print("[WebSocket] Tipo desconocido: \(type)")
        }
    }
    
    // MARK: - Gestión de Transcripción
    
    private func appendTranscriptLine(_ text: String) {
        guard !text.isEmpty else { return }
        
        // Agregar como nueva línea
        withAnimation(.easeOut(duration: 0.2)) {
            transcriptLines.append(text)
            
            // Mantener solo las últimas maxLines
            if transcriptLines.count > maxLines {
                transcriptLines.removeFirst(transcriptLines.count - maxLines)
            }
        }
        
        currentLine = text
    }
    
    private func appendTypingText(_ text: String) {
        // Agregar texto con efecto typing
        typingBuffer += text
        isStreaming = true
        
        if typingIndex == nil {
            typingIndex = typingBuffer.startIndex
            startTypingTimer()
        }
    }
    
    private func startTypingTimer() {
        typingTimer?.invalidate()
        typingTimer = Timer.scheduledTimer(withTimeInterval: typingSpeed, repeats: true) { [weak self] _ in
            self?.typeNextCharacter()
        }
    }
    
    private func typeNextCharacter() {
        guard let index = typingIndex, index < typingBuffer.endIndex else {
            stopTyping()
            // Agregar como línea final
            if !typingBuffer.isEmpty {
                appendTranscriptLine(typingBuffer)
                typingBuffer = ""
            }
            return
        }
        
        let char = String(typingBuffer[index])
        currentLine = String(typingBuffer[typingBuffer.startIndex...index])
        
        typingIndex = typingBuffer.index(after: index)
    }
    
    private func stopTyping() {
        typingTimer?.invalidate()
        typingTimer = nil
        isStreaming = false
        isThinking = false
    }
    
    // MARK: - Cleanup
    
    func clearText() {
        stopTyping()
        typingBuffer = ""
        currentLine = ""
        transcriptLines.removeAll()
        isListening = false
        errorMessage = nil
    }
}
