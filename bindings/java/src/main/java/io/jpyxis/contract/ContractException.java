package io.jpyxis.contract;

public final class ContractException extends RuntimeException {
    private final String code;

    public ContractException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
