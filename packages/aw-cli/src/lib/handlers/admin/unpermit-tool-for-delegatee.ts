import {
  Admin as AwAdmin,
  RegisteredToolsResult,
  RegisteredToolWithPolicies,
  ToolMetadata,
  type PkpInfo,
} from '@lit-protocol/agent-wallet';
import prompts from 'prompts';

import { AwCliError, AwCliErrorType } from '../../errors';
import { logger } from '../../utils/logger';

const promptSelectDelegateeToUnpermitToolFor = async (delegatees: string[]) => {
  const { delegatee } = await prompts({
    type: 'select',
    name: 'delegatee',
    message: 'Select a delegatee to unpermit tool for:',
    choices: delegatees.map((delegatee) => ({
      title: delegatee,
      value: delegatee,
    })),
  });

  if (!delegatee) {
    throw new AwCliError(
      AwCliErrorType.ADMIN_UNPERMIT_TOOL_FOR_DELEGATEE_CANCELLED,
      'Unpermit tool for delegatee cancelled.'
    );
  }

  return delegatee;
};

const promptSelectToolToUnpermit = async (
  registeredToolsResult: RegisteredToolsResult
) => {
  // No filtering applied here as it's done after getting permitted tools
  const choices = [
    ...Object.values(registeredToolsResult.toolsWithPolicies).map((tool) => ({
      title: `${tool.name} (${tool.ipfsCid})`,
      value: tool,
    })),
    ...Object.values(registeredToolsResult.toolsWithoutPolicies).map(
      (tool) => ({
        title: `${tool.name} (${tool.ipfsCid})`,
        value: tool,
      })
    ),
  ];

  // Prompt the user to select a tool.
  const { tool } = await prompts({
    type: 'select',
    name: 'tool',
    message: 'Select a tool to unpermit for delegatee:',
    choices,
  });

  // Throw an error if the user cancels the selection.
  if (!tool) {
    throw new AwCliError(
      AwCliErrorType.ADMIN_UNPERMIT_TOOL_FOR_DELEGATEE_CANCELLED,
      'Unpermit tool for delegatee cancelled.'
    );
  }

  // Return the selected tool.
  return tool as RegisteredToolWithPolicies | ToolMetadata;
};

export const handleUnpermitToolForDelegatee = async (
  awAdmin: AwAdmin,
  pkp: PkpInfo
) => {
  try {
    const registeredTools = await awAdmin.getRegisteredToolsAndDelegateesForPkp(
      pkp.info.tokenId
    );

    if (
      registeredTools === null ||
      (Object.keys(registeredTools.toolsWithPolicies).length === 0 &&
        Object.keys(registeredTools.toolsWithoutPolicies).length === 0 &&
        Object.keys(registeredTools.toolsUnknownWithPolicies).length === 0)
    ) {
      throw new AwCliError(
        AwCliErrorType.ADMIN_UNPERMIT_TOOL_FOR_DELEGATEE_NO_PERMITTED_TOOLS,
        'No permitted tools found.'
      );
    }

    const delegatee = await promptSelectDelegateeToUnpermitToolFor(
      await awAdmin.getDelegatees(pkp.info.tokenId)
    );

    const permittedTools = await awAdmin.getPermittedToolsForDelegatee(
      pkp.info.tokenId,
      delegatee
    );

    // Filter to only include tools that are permitted for the delegatee
    const permittedToolIpfsCids = new Set(
      permittedTools.map((permittedTool) => permittedTool.toolIpfsCid)
    );

    const filteredToolsWithPolicies = Object.fromEntries(
      Object.entries(registeredTools.toolsWithPolicies).filter(
        ([toolIpfsCid]) => permittedToolIpfsCids.has(toolIpfsCid)
      )
    );

    const filteredToolsWithoutPolicies = Object.fromEntries(
      Object.entries(registeredTools.toolsWithoutPolicies).filter(
        ([toolIpfsCid]) => permittedToolIpfsCids.has(toolIpfsCid)
      )
    );

    const filteredToolsUnknownWithPolicies = Object.fromEntries(
      Object.entries(registeredTools.toolsUnknownWithPolicies).filter(
        ([toolIpfsCid]) => permittedToolIpfsCids.has(toolIpfsCid)
      )
    );

    // Update registeredTools with the filtered results
    registeredTools.toolsWithPolicies = filteredToolsWithPolicies;
    registeredTools.toolsWithoutPolicies = filteredToolsWithoutPolicies;
    registeredTools.toolsUnknownWithPolicies = filteredToolsUnknownWithPolicies;

    if (
      registeredTools === null ||
      (Object.keys(registeredTools.toolsWithPolicies).length === 0 &&
        Object.keys(registeredTools.toolsWithoutPolicies).length === 0 &&
        Object.keys(registeredTools.toolsUnknownWithPolicies).length === 0)
    ) {
      throw new AwCliError(
        AwCliErrorType.ADMIN_UNPERMIT_TOOL_FOR_DELEGATEE_NO_PERMITTED_TOOLS,
        'No permitted tools found for this delegatee.'
      );
    }

    const selectedTool = await promptSelectToolToUnpermit(registeredTools);

    logger.loading('Unpermitting tool for delegatee...');
    await awAdmin.unpermitToolForDelegatee(
      pkp.info.tokenId,
      selectedTool.ipfsCid,
      delegatee
    );
    logger.success('Tool unpermitted successfully.');
  } catch (error) {
    // Handle specific errors related to tool policy retrieval.
    if (error instanceof AwCliError) {
      if (
        error.type ===
        AwCliErrorType.ADMIN_UNPERMIT_TOOL_FOR_DELEGATEE_NO_PERMITTED_TOOLS
      ) {
        // Log an error message if no permitted tools are found.
        logger.error('No permitted tools found.');
        return;
      }

      if (
        error.type ===
        AwCliErrorType.ADMIN_UNPERMIT_TOOL_FOR_DELEGATEE_CANCELLED
      ) {
        // Log an error message if the user cancels the operation.
        logger.error('Unpermit tool for delegatee cancelled.');
        return;
      }
    }

    // Re-throw any other errors to be handled by the caller.
    throw error;
  }
};
