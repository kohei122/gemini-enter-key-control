(() => {
  const DEBUG_LOG_FLOW_MAIN = false;
  const BRIDGE_KEY = "__geminiEnterKeyControlFlowMainBridge";
  const DISCOVER_EVENT = "__gecFlowReactBridgeDiscover";
  const READY_EVENT = "__gecFlowReactBridgeReady";
  const REQUEST_EVENT = "__gecFlowReactBridgeRequest";
  const RESPONSE_EVENT = "__gecFlowReactBridgeResponse";
  const TARGET_ATTRIBUTE = "data-gec-flow-react-target";
  const TEXTBOX_ATTRIBUTE = "data-gec-flow-react-textbox";
  const FLOW_TEXTBOX_SELECTOR =
    '[data-slate-editor="true"][role="textbox"][contenteditable="true"]';
  const MAX_FIBER_DEPTH = 15;
  const TRUSTED_KEYDOWN_MAX_AGE_MS = 250;
  const INVOCATION_PHASES = ["no-argument", "minimal-event", "trusted-native-key-event"];
  const EXCLUDED_SYMBOLS = ["stop", "close", "add_2", "article_spark", "tune"];

  function isFlowPage() {
    return location.hostname === "labs.google" && location.pathname.includes("/tools/flow/");
  }

  if (!isFlowPage() || window[BRIDGE_KEY]) return;

  const randomValues = new Uint32Array(4);
  crypto.getRandomValues(randomValues);
  const token = Array.from(randomValues, (value) => value.toString(16).padStart(8, "0")).join("");
  const handledRequestIds = new Set();
  const inspectedButtons = new WeakSet();
  let lastTrustedKeydown = null;
  let trustedKeydownExpiryTimer = null;

  Object.defineProperty(window, BRIDGE_KEY, {
    value: { version: 1 },
    configurable: false,
    enumerable: false,
    writable: false
  });

  function logMainDebug(message, details = {}) {
    if (!DEBUG_LOG_FLOW_MAIN) return;
    console.debug(`[Gemini Enter Key Control] Flow MAIN ${message}`, details);
  }

  function logMainWarning(message, details = {}) {
    console.warn(`[Gemini Enter Key Control] Flow MAIN ${message}`, details);
  }

  function getButtonContent(button) {
    return button instanceof HTMLButtonElement ? (button.textContent || "").toLowerCase() : "";
  }

  function hasMaterialSymbol(button, symbolName) {
    return getButtonContent(button).includes(symbolName);
  }

  function isValidGenerateButton(button) {
    if (!(button instanceof HTMLButtonElement)) return false;
    if (!button.isConnected || button.disabled || button.getAttribute("aria-disabled") === "true") return false;
    if (!hasMaterialSymbol(button, "arrow_forward")) return false;
    if (EXCLUDED_SYMBOLS.some((symbol) => hasMaterialSymbol(button, symbol))) return false;

    const rect = button.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = getComputedStyle(button);
    if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") return false;
    if (style.pointerEvents === "none") return false;
    const opacity = Number.parseFloat(style.opacity);
    return !Number.isFinite(opacity) || opacity > 0;
  }

  function summarizeFunction(handler) {
    if (typeof handler !== "function") return null;
    if (!DEBUG_LOG_FLOW_MAIN) {
      return { name: handler.name || "anonymous", length: handler.length };
    }
    let source = "";
    try {
      source = Function.prototype.toString.call(handler);
    } catch {
      source = "[source unavailable]";
    }
    return {
      name: handler.name || "anonymous",
      length: handler.length,
      sourceLength: source.length,
      sourceStart: source.slice(0, 200)
    };
  }

  function getFunctionPropertyNames(props) {
    if (!DEBUG_LOG_FLOW_MAIN) return [];
    if (!props || typeof props !== "object") return [];
    return Object.keys(props)
      .filter((key) => typeof props[key] === "function")
      .slice(0, 30);
  }

  function inspectReactButton(button) {
    const ownPropertyNames = Object.getOwnPropertyNames(button);
    const reactPropertyNames = ownPropertyNames.filter((name) => /react/i.test(name));
    const propsPropertyName = reactPropertyNames.find((name) => name.startsWith("__reactProps$")) || null;
    const fiberPropertyName = reactPropertyNames.find((name) => {
      return name.startsWith("__reactFiber$") || name.startsWith("__reactInternalInstance$");
    }) || null;
    const directProps = propsPropertyName ? button[propsPropertyName] : null;
    const fiber = fiberPropertyName ? button[fiberPropertyName] : null;
    const fiberChain = [];
    let returnChainDepth = 0;
    let handler = typeof directProps?.onClick === "function" ? directProps.onClick : null;
    let handlerLocation = handler ? "direct-react-props.onClick" : null;
    let currentFiber = fiber;

    for (let depth = 0; currentFiber && depth < MAX_FIBER_DEPTH; depth += 1) {
      returnChainDepth = depth + 1;
      const memoizedProps = currentFiber.memoizedProps;
      const pendingProps = currentFiber.pendingProps;
      if (DEBUG_LOG_FLOW_MAIN) {
        fiberChain.push({
          depth,
          tag: currentFiber.tag,
          memoizedPropsKeys: memoizedProps && typeof memoizedProps === "object"
            ? Object.keys(memoizedProps).slice(0, 40)
            : [],
          pendingPropsKeys: pendingProps && typeof pendingProps === "object"
            ? Object.keys(pendingProps).slice(0, 40)
            : [],
          memoizedFunctionKeys: getFunctionPropertyNames(memoizedProps),
          pendingFunctionKeys: getFunctionPropertyNames(pendingProps),
          stateNodeType: currentFiber.stateNode?.constructor?.name || typeof currentFiber.stateNode,
          hasUpdateQueue: Boolean(currentFiber.updateQueue),
          hasMemoizedState: Boolean(currentFiber.memoizedState)
        });
      }

      if (!handler && typeof memoizedProps?.onClick === "function") {
        handler = memoizedProps.onClick;
        handlerLocation = `fiber[${depth}].memoizedProps.onClick`;
      }
      if (!handler && typeof pendingProps?.onClick === "function") {
        handler = pendingProps.onClick;
        handlerLocation = `fiber[${depth}].pendingProps.onClick`;
      }
      currentFiber = currentFiber.return;
    }

    return {
      handler,
      diagnostics: {
        reactPropertyNames: DEBUG_LOG_FLOW_MAIN ? reactPropertyNames : [],
        directPropsKeys: DEBUG_LOG_FLOW_MAIN && directProps && typeof directProps === "object"
          ? Object.keys(directProps).slice(0, 60)
          : [],
        directHandlers: DEBUG_LOG_FLOW_MAIN ? {
          onClick: typeof directProps?.onClick,
          onPointerDown: typeof directProps?.onPointerDown,
          onMouseDown: typeof directProps?.onMouseDown,
          onKeyDown: typeof directProps?.onKeyDown,
          onKeyUp: typeof directProps?.onKeyUp
        } : null,
        disabled: button.disabled,
        ariaDisabled: button.getAttribute("aria-disabled"),
        fiberTag: fiber?.tag ?? null,
        reactHandlerFound: typeof handler === "function",
        handlerLocation,
        handlerSummary: summarizeFunction(handler),
        returnChainDepth,
        fiberChain
      }
    };
  }

  function createMinimalReactEvent(button, nativeEvent = null) {
    let defaultPrevented = false;
    let propagationStopped = false;

    return {
      type: "click",
      target: button,
      currentTarget: button,
      nativeEvent,
      preventDefault() { defaultPrevented = true; },
      stopPropagation() { propagationStopped = true; },
      isDefaultPrevented() { return defaultPrevented; },
      isPropagationStopped() { return propagationStopped; },
      persist() {},
      isPersistent() { return true; },
      get defaultPrevented() { return defaultPrevented; },
      bubbles: true,
      cancelable: true
    };
  }

  function getFlowTextboxFromTarget(target) {
    const element = target instanceof Element ? target : target?.parentElement;
    if (!(element instanceof Element)) return null;
    const textbox = element.closest(FLOW_TEXTBOX_SELECTOR);
    return textbox instanceof HTMLElement ? textbox : null;
  }

  function describeTarget(target) {
    if (!(target instanceof Element)) return null;
    return {
      tagName: target.tagName,
      role: target.getAttribute("role"),
      contentEditable: target.getAttribute("contenteditable"),
      dataSlateEditor: target.getAttribute("data-slate-editor")
    };
  }

  function getModifiers(source) {
    return {
      shiftKey: source?.shiftKey === true,
      ctrlKey: source?.ctrlKey === true,
      metaKey: source?.metaKey === true,
      altKey: source?.altKey === true
    };
  }

  function modifiersMatch(expected, actual) {
    if (!expected || typeof expected !== "object") return false;
    return expected.shiftKey === actual.shiftKey &&
      expected.ctrlKey === actual.ctrlKey &&
      expected.metaKey === actual.metaKey &&
      expected.altKey === actual.altKey;
  }

  function clearTrustedKeydown(expectedRecord = null) {
    if (expectedRecord && lastTrustedKeydown !== expectedRecord) return;
    lastTrustedKeydown = null;
    if (trustedKeydownExpiryTimer !== null) {
      clearTimeout(trustedKeydownExpiryTimer);
      trustedKeydownExpiryTimer = null;
    }
  }

  function captureTrustedKeydown(event) {
    const isEnter = event.key === "Enter" || event.code === "Enter";
    const textbox = getFlowTextboxFromTarget(event.target);
    if (textbox) clearTrustedKeydown();
    if (!event.isTrusted || !isEnter || !textbox || event.isComposing || event.altKey || event.repeat) {
      return;
    }

    const record = {
      event,
      textbox,
      observedAt: performance.now(),
      key: event.key,
      code: event.code,
      modifiers: getModifiers(event),
      targetSummary: describeTarget(event.target)
    };
    lastTrustedKeydown = record;
    trustedKeydownExpiryTimer = setTimeout(() => {
      clearTrustedKeydown(record);
    }, TRUSTED_KEYDOWN_MAX_AGE_MS);
    logMainDebug("trusted keydown captured", {
      key: record.key,
      code: record.code,
      modifiers: record.modifiers,
      isTrusted: event.isTrusted,
      target: record.targetSummary
    });
  }

  function consumeTrustedKeydown(expectedModifiers, expectedTextbox) {
    const record = lastTrustedKeydown;
    clearTrustedKeydown(record);
    const ageMs = record ? performance.now() - record.observedAt : null;
    const actualModifiers = record?.modifiers || null;
    const modifierMatch = Boolean(record) && modifiersMatch(expectedModifiers, actualModifiers);
    const targetMatch = Boolean(record) && record.textbox === expectedTextbox;
    let rejectionReason = null;

    if (!record) rejectionReason = "trusted keydown was not captured";
    else if (ageMs > TRUSTED_KEYDOWN_MAX_AGE_MS) rejectionReason = "trusted keydown expired";
    else if (record.event.isTrusted !== true) rejectionReason = "native event is not trusted";
    else if (record.key !== "Enter" && record.code !== "Enter") rejectionReason = "native event is not Enter";
    else if (!targetMatch) rejectionReason = "Flow textbox target mismatch";
    else if (!modifierMatch) rejectionReason = "modifier mismatch";

    const diagnostics = {
      accepted: rejectionReason === null,
      ageMs,
      modifierMatch,
      targetMatch,
      expectedModifiers,
      actualModifiers,
      nativeEventConstructor: record?.event?.constructor?.name || null,
      nativeEventType: record?.event?.type || null,
      nativeEventIsTrusted: record?.event?.isTrusted === true,
      rejectionReason
    };
    if (diagnostics.accepted) {
      logMainDebug("trusted native event accepted", diagnostics);
    } else {
      logMainWarning("trusted native event rejected", {
        rejectionReason,
        ageMs,
        modifierMatch,
        targetMatch
      });
    }
    return { event: diagnostics.accepted ? record.event : null, diagnostics };
  }

  function findMarkedButton(requestId) {
    const buttons = document.querySelectorAll(`button[${TARGET_ATTRIBUTE}]`);
    for (const button of buttons) {
      if (button.getAttribute(TARGET_ATTRIBUTE) === requestId) return button;
    }
    return null;
  }

  function findMarkedTextbox(requestId) {
    const textboxes = document.querySelectorAll(`[${TEXTBOX_ATTRIBUTE}]`);
    for (const textbox of textboxes) {
      if (textbox.getAttribute(TEXTBOX_ATTRIBUTE) === requestId &&
          textbox.matches(FLOW_TEXTBOX_SELECTOR) &&
          (textbox.textContent || "").trim().length > 0) {
        return textbox;
      }
    }
    return null;
  }

  function sendResponse(requestId, response) {
    document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
      detail: { token, requestId, ...response }
    }));
  }

  document.addEventListener("keydown", captureTrustedKeydown, true);

  if (DEBUG_LOG_FLOW_MAIN) {
    document.addEventListener("click", (event) => {
      const button = event.target instanceof Element ? event.target.closest("button") : null;
      if (!isValidGenerateButton(button)) return;
      const inspection = inspectReactButton(button);
      logMainDebug("trusted click observed", {
        isTrusted: event.isTrusted,
        type: event.type,
        handlerLocation: inspection.diagnostics.handlerLocation,
        handlerSummary: inspection.diagnostics.handlerSummary
      });
      if (!inspectedButtons.has(button)) {
        inspectedButtons.add(button);
        logMainDebug("React inspection", inspection.diagnostics);
      }
    }, true);
  }

  document.addEventListener(DISCOVER_EVENT, () => {
    document.dispatchEvent(new CustomEvent(READY_EVENT, {
      detail: { token, version: 1 }
    }));
  });

  document.addEventListener(REQUEST_EVENT, (event) => {
    const detail = event.detail;
    if (!detail || detail.token !== token || typeof detail.requestId !== "string") return;
    if (handledRequestIds.has(detail.requestId)) return;
    if (handledRequestIds.size >= 100) {
      const oldestRequestId = handledRequestIds.values().next().value;
      handledRequestIds.delete(oldestRequestId);
    }
    handledRequestIds.add(detail.requestId);

    const button = findMarkedButton(detail.requestId);
    if (!isValidGenerateButton(button)) {
      clearTrustedKeydown();
      sendResponse(detail.requestId, { invoked: false, error: "valid generate button not found" });
      return;
    }
    const textbox = findMarkedTextbox(detail.requestId);
    if (!textbox) {
      clearTrustedKeydown();
      logMainWarning("bridge target textbox missing");
      sendResponse(detail.requestId, { invoked: false, error: "marked Flow textbox not found" });
      return;
    }

    try {
      const inspection = inspectReactButton(button);
      logMainDebug("React handler inspection", inspection.diagnostics);
      if (typeof inspection.handler !== "function") {
        clearTrustedKeydown();
        logMainWarning("React onClick handler not found", {
          handlerLocation: inspection.diagnostics.handlerLocation
        });
        sendResponse(detail.requestId, {
          invoked: false,
          diagnostics: inspection.diagnostics,
          error: "React onClick handler not found"
        });
        return;
      }

      const phase = INVOCATION_PHASES.includes(detail.phase) ? detail.phase : "minimal-event";
      const trustedKeydown = phase === "trusted-native-key-event"
        ? consumeTrustedKeydown(detail.expectedModifiers, textbox)
        : { event: null, diagnostics: null };
      if (phase !== "trusted-native-key-event") clearTrustedKeydown();
      if (phase === "trusted-native-key-event" && !trustedKeydown.event) {
        sendResponse(detail.requestId, {
          invoked: false,
          phase,
          trustedKeydown: trustedKeydown.diagnostics,
          diagnostics: inspection.diagnostics,
          error: trustedKeydown.diagnostics.rejectionReason
        });
        return;
      }
      const invocationArgument = phase === "no-argument"
        ? undefined
        : createMinimalReactEvent(button, trustedKeydown.event);
      logMainDebug("React handler invocation phase", {
        phase,
        handlerLocation: inspection.diagnostics.handlerLocation,
        handlerThis: "null",
        argumentType: phase === "no-argument" ? "none" : "React-compatible plain object",
        trustedNativeEventIncluded: Boolean(trustedKeydown.event),
        nativeEventConstructor: trustedKeydown.event?.constructor?.name || null,
        nativeEventType: trustedKeydown.event?.type || null,
        nativeEventIsTrusted: trustedKeydown.event?.isTrusted === true
      });
      const result = phase === "no-argument"
        ? inspection.handler.call(null)
        : inspection.handler.call(null, invocationArgument);
      if (result && typeof result.then === "function") {
        Promise.resolve(result).catch((error) => {
          logMainWarning("React handler async exception", {
            phase,
            error: String(error).slice(0, 500)
          });
        });
      }
      logMainDebug("React handler invocation result", {
        phase,
        resultType: typeof result,
        returnedPromiseLike: Boolean(result && typeof result.then === "function")
      });
      sendResponse(detail.requestId, {
        invoked: true,
        phase,
        resultType: typeof result,
        handlerThis: "null",
        trustedKeydown: trustedKeydown.diagnostics,
        diagnostics: inspection.diagnostics
      });
    } catch (error) {
      clearTrustedKeydown();
      logMainWarning("React handler exception", {
        phase: detail.phase || "minimal-event",
        error: String(error).slice(0, 500)
      });
      sendResponse(detail.requestId, {
        invoked: false,
        error: String(error).slice(0, 500)
      });
    }
  });

  logMainDebug("world bridge initialized", {
    version: 1,
    maxFiberDepth: MAX_FIBER_DEPTH,
    trustedKeydownMaxAgeMs: TRUSTED_KEYDOWN_MAX_AGE_MS
  });
})();
