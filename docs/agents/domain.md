# Domain documentation

## Layout

Este é um projeto de contexto único.

- O vocabulário canônico está em `GLOSSARY.md`, na raiz.
- As especificações de produto ficam em `docs/specs/`.
- Decisões arquiteturais difíceis de reverter devem ser registradas em `docs/adr/`.

## Consumer rules

1. Leia o glossário antes de escrever requisitos, issues ou código de domínio.
2. Use exatamente os termos canônicos, especialmente Operação Lyra, Empresa Cliente, Produto Digital, Período de Análise e MVP do Painel.
3. Não trate indisponibilidade como valor zero.
4. Consulte ADRs aplicáveis antes de alterar uma decisão arquitetural.
5. Não crie ADR para escolhas locais e facilmente reversíveis.
6. Se um requisito contradizer o glossário, esclareça ou atualize a documentação antes de implementar.
