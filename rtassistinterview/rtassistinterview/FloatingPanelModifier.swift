//
//  FloatingPanelModifier.swift
//  rtassistinterview
//
//  Modifier para mostrar/ocultar el panel flotante
//

import SwiftUI

struct FloatingPanelModifier<PanelContent: View>: ViewModifier {
    @Binding var isPresented: Bool
    var contentRect: CGRect
    @ViewBuilder let content: () -> PanelContent
    
    @State private var panel: FloatingPanel<PanelContent>?
    
    func body(content: Content) -> some View {
        content
            .onAppear {
                setupPanel()
                if isPresented { present() }
            }
            .onDisappear {
                panel?.close()
                panel = nil
            }
            .onChange(of: isPresented) { newValue in
                if newValue {
                    present()
                } else {
                    dismiss()
                }
            }
    }
    
    private func setupPanel() {
        guard panel == nil else { return }
        panel = FloatingPanel(
            view: content,
            contentRect: contentRect,
            isPresented: $isPresented
        )
    }
    
    private func present() {
        guard let panel = panel else { return }
        
        panel.alphaValue = 0
        panel.orderFront(nil)
        
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.25
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            panel.animator().alphaValue = 1.0
        }
    }
    
    private func dismiss() {
        guard let panel = panel else { return }
        
        NSAnimationContext.runAnimationGroup({ context in
            context.duration = 0.2
            context.timingFunction = CAMediaTimingFunction(name: .easeIn)
            panel.animator().alphaValue = 0
        }, completionHandler: {
            panel.close()
        })
    }
}

extension View {
    func floatingPanel<Content: View>(
        isPresented: Binding<Bool>,
        contentRect: CGRect = CGRect(x: 0, y: 0, width: 500, height: 120),
        @ViewBuilder content: @escaping () -> Content
    ) -> some View {
        self.modifier(FloatingPanelModifier(
            isPresented: isPresented,
            contentRect: contentRect,
            content: content
        ))
    }
}
