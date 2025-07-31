import type {
  AnthropicMessage,
  AnthropicAssistantMessage,
} from "./anthropic-types"

/**
 * Validates and cleans up tool conversations to ensure each tool_use block
 * has a corresponding tool_result block. This prevents 400 errors when
 * tool calls are cancelled or incomplete.
 *
 * Only removes tool_use blocks that are clearly abandoned (have subsequent
 * messages without tool_result blocks).
 *
 * @param messages The array of Anthropic messages to validate and clean
 * @returns A cleaned array with incomplete tool_use blocks removed
 */
export function validateAndCleanupToolConversations(
  messages: Array<AnthropicMessage>,
): Array<AnthropicMessage> {
  if (messages.length === 0) {
    return messages
  }

  // Find all tool_use blocks and their corresponding tool_result blocks
  const toolUseBlocks = new Map<
    string,
    { messageIndex: number; blockIndex: number }
  >()
  const toolResultBlocks = new Set<string>()

  // First pass: collect all tool_use and tool_result blocks
  for (const [messageIndex, message] of messages.entries()) {
    if (!Array.isArray(message.content)) {
      continue
    }

    for (const [blockIndex, block] of message.content.entries()) {
      if (block.type === "tool_use") {
        toolUseBlocks.set(block.id, { messageIndex, blockIndex })
      } else if (block.type === "tool_result") {
        toolResultBlocks.add(block.tool_use_id)
      }
    }
  }

  // Find tool_use blocks that are truly abandoned
  const abandonedToolUseIds = new Set<string>()
  for (const [toolUseId, toolInfo] of toolUseBlocks) {
    // If there's already a tool_result, it's not abandoned
    if (toolResultBlocks.has(toolUseId)) {
      continue
    }

    // Check if there are subsequent messages after this tool_use
    // If yes, and no tool_result was provided, the tool call was abandoned
    let hasSubsequentMessage = false
    for (let i = toolInfo.messageIndex + 1; i < messages.length; i++) {
      // Any message after a tool_use without tool_result indicates abandonment
      // This includes both user messages and assistant messages
      hasSubsequentMessage = true
      break
    }

    // Only mark as abandoned if there are subsequent messages
    // This preserves tool_use blocks at the end of conversations
    if (hasSubsequentMessage) {
      abandonedToolUseIds.add(toolUseId)
    }
  }

  // If no abandoned tool calls, return original messages
  if (abandonedToolUseIds.size === 0) {
    return messages
  }

  // Second pass: remove abandoned tool_use blocks
  return messages.map((message) => {
    if (!Array.isArray(message.content)) {
      return message
    }

    const filteredContent = message.content.filter((block) => {
      if (block.type === "tool_use") {
        return !abandonedToolUseIds.has(block.id)
      }
      return true
    })

    // If the message is an assistant message and all content was filtered out,
    // keep at least an empty array to maintain message structure
    if (message.role === "assistant") {
      return {
        ...message,
        content: filteredContent,
      } as AnthropicAssistantMessage
    }

    return {
      ...message,
      content: filteredContent,
    }
  })
}

/**
 * Helper function to check if a message array contains abandoned tool conversations
 * (tool_use blocks followed by any messages without tool_result blocks)
 * @param messages The array of Anthropic messages to check
 * @returns true if there are abandoned tool conversations
 */
export function hasIncompleteToolConversations(
  messages: Array<AnthropicMessage>,
): boolean {
  const toolUseBlocks = new Map<string, number>() // id -> messageIndex
  const toolResultIds = new Set<string>()

  // Collect tool_use and tool_result blocks
  for (const [messageIndex, message] of messages.entries()) {
    if (!Array.isArray(message.content)) {
      continue
    }

    for (const block of message.content) {
      if (block.type === "tool_use") {
        toolUseBlocks.set(block.id, messageIndex)
      } else if (block.type === "tool_result") {
        toolResultIds.add(block.tool_use_id)
      }
    }
  }

  // Check if any tool_use is abandoned (followed by any messages without tool_result)
  for (const [toolUseId, toolMessageIndex] of toolUseBlocks) {
    if (toolResultIds.has(toolUseId)) {
      continue // Has result, not abandoned
    }

    // Check if there are subsequent messages
    for (let i = toolMessageIndex + 1; i < messages.length; i++) {
      // Any subsequent message indicates the tool call was abandoned
      return true // Found abandoned tool call
    }
  }

  return false
}
