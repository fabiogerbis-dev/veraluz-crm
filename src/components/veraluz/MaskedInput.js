import { forwardRef } from "react";
import PropTypes from "prop-types";
import { IMaskInput } from "react-imask";
import MDInput from "components/MDInput";

const MaskedInputInner = forwardRef(function MaskedInputInner(props, ref) {
  const { onChange, mask, ...other } = props;

  return (
    <IMaskInput
      {...other}
      mask={mask}
      inputRef={ref}
      onAccept={(value) => onChange({ target: { name: props.name, value } })}
      overwrite
    />
  );
});

MaskedInputInner.propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  mask: PropTypes.string.isRequired,
};

const MASKS = {
  phone: "(00) 00000-0000",
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
};

function MaskedInput({ maskType, ...rest }) {
  return (
    <MDInput
      {...rest}
      InputProps={{
        ...rest.InputProps,
        inputComponent: MaskedInputInner,
        inputProps: { ...(rest.InputProps?.inputProps || {}), mask: MASKS[maskType] },
      }}
    />
  );
}

MaskedInput.propTypes = {
  maskType: PropTypes.oneOf(["phone", "cpf", "cnpj"]).isRequired,
};

export default MaskedInput;
